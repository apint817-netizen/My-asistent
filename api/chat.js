export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const bodyText = await req.text();
        const requestData = JSON.parse(bodyText);
        const { model, messages, temperature = 0.9, max_tokens = 2048 } = requestData;

        const authHeader = req.headers.get('authorization') || '';
        let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '') {
            clientKey = null;
        }

        // Ключ пользователя должен быть ТОЛЬКО в переменных окружения (Vercel)
        // В Edge Runtime иногда process.env не существует напрямую, используется глобальный process
        const envKeyRaw = typeof process !== 'undefined' && process.env ? process.env.GOOGLE_API_KEY : null;

        let validKeys = [];
        if (clientKey) validKeys.push(clientKey);

        if (envKeyRaw) {
            // Разделяем по запятым, если в Vercel введено несколько ключей (Multi-Key)
            const envKeys = envKeyRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);
            validKeys.push(...envKeys);
        }

        // Убираем дубликаты
        validKeys = [...new Set(validKeys)];

        if (validKeys.length === 0) {
            return new Response(JSON.stringify({ error: 'API Key не настроен. Добавьте GOOGLE_API_KEY в переменные окружения Vercel (можно несколько через запятую).' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let targetModel = model || 'gemini-2.0-flash';

        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => {
                const role = m.role === 'assistant' ? 'model' : 'user';
                if (Array.isArray(m.content)) {
                    const parts = m.content.map(part => {
                        if (part.type === 'text') return { text: part.text };
                        if (part.type === 'image_url' && part.image_url?.url) {
                            const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                            if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
                            return { text: '[image]' };
                        }
                        return { text: JSON.stringify(part) };
                    });
                    return { role, parts };
                }
                return { role, parts: [{ text: m.content }] };
            });

        const geminiBody = {
            contents,
            generationConfig: { temperature, maxOutputTokens: max_tokens }
        };

        if (systemInstruction) {
            geminiBody.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        const callGemini = async (modelName, currentKey) => {
            const clean = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName;
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${currentKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
            );
            if (!resp.ok) {
                const text = await resp.text();
                const status = resp.status;
                const err = new Error(`HTTP ${status}: ${text.substring(0, 300)}`);
                err.status = status;
                throw err;
            }
            return { data: await resp.json(), model: clean };
        };

        // Расширенная fallback-цепочка: от новейших к самым стабильным
        let modelsToTry = [
            targetModel.startsWith('models/') ? targetModel.replace('models/', '') : targetModel,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
        ];

        // Убираем дубликаты
        modelsToTry = [...new Set(modelsToTry)];

        let result = null;
        let errors = [];

        // Внешний цикл по ключам
        for (let k = 0; k < validKeys.length; k++) {
            const currentKey = validKeys[k];
            let isKeyExhausted = false;

            // Внутренний цикл по моделям
            for (const m of modelsToTry) {
                if (isKeyExhausted) break; // Ключ мертв, переходим к следующему ключу

                try {
                    result = await callGemini(m, currentKey);
                    break; // Успех! Выходим из цикла моделей
                } catch (e) {
                    errors.push(`[Key ${k} - ${m}] ${e.message}`);

                    // Если ключ неверный (400, 401, 403) или лимиты полностью исчерпаны (429)
                    if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 429) {
                        isKeyExhausted = true;
                    }
                    console.warn(`Fallback: Model ${m} with Key ${k} failed:`, e.message);
                    continue;
                }
            }
            if (result) break; // Успех! Выходим из цикла ключей
        }

        // Крайний случай - пробуем найти доступную модель программно (используя первый рабочий ключ, если он есть, иначе пропускаем)
        if (!result && validKeys.length > 0) {
            try {
                // Пробуем первый ключ для поиска моделей
                const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${validKeys[0]}`);
                if (listRes.ok) {
                    const listData = await listRes.json();
                    const available = (listData.models || [])
                        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                        .map(m => m.name.replace('models/', ''));

                    const bestModel = available.find(m => m.includes('flash')) || available[0];
                    if (bestModel) {
                        result = await callGemini(bestModel, validKeys[0]);
                    }
                }
            } catch (e) {
                console.warn('Dynamic lookup failed');
            }
        }

        // Если все ключи Google отвалились, пробуем OpenRouter Lifeline
        if (!result && process.env.OPENROUTER_API_KEY) {
            console.log("Google keys exhausted. Falling back to OpenRouter...");
            try {
                const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://my-asisstient.vercel.app',
                        'X-Title': 'Nova Assistant'
                    },
                    // Передаем оригинальные messages в формате OpenAI
                    body: JSON.stringify({
                        model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
                        messages: requestData.messages,
                        temperature,
                        max_tokens: max_tokens || 2048
                    })
                });
                
                if (orResp.ok) {
                    const orData = await orResp.json();
                    if (orData.choices && orData.choices[0]?.message?.content) {
                        return new Response(JSON.stringify({
                            choices: [{ message: { role: 'assistant', content: orData.choices[0].message.content } }],
                            usage: { total_tokens: orData.usage?.total_tokens || 0 },
                            model_used: 'openrouter-free',
                            keys_count: validKeys.length
                        }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                } else {
                    const errorText = await orResp.text();
                    errors.push(`[OpenRouter Fallback] HTTP ${orResp.status}: ${errorText.substring(0, 150)}`);
                }
            } catch (e) {
               errors.push(`[OpenRouter Fallback Error] ${e.message}`);
            }
        }

        if (!result) {
            throw new Error(`Все аккаунты исчерпаны. Последняя ошибка: ${errors[errors.length - 1]}`);
        }

        const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return new Response(JSON.stringify({
            choices: [{ message: { role: 'assistant', content: text } }],
            usage: { total_tokens: result.data.usageMetadata?.totalTokenCount || 0 },
            model_used: result.model,
            keys_count: validKeys.length
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('AI Error:', error.message);
        return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
