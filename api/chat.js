export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { model, messages, temperature = 0.9, max_tokens = 2048 } = req.body;

        const authHeader = req.headers.authorization || '';
        let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '') {
            clientKey = null;
        }

        // Собираем все доступные ключи (по приоритету):
        // 1. Ключ пользователя из UI (если есть)
        // 2. Основной серверный ключ из Vercel ENV
        // 3. Резервный ключ (fallback_key) из test-real-key.mjs
        const envKey = process.env.GOOGLE_API_KEY || null;
        const backupKey = "AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc";

        let validKeys = [clientKey, envKey, backupKey].filter(k => k && k.trim() !== '' && k !== 'undefined' && k !== 'null');
        // Убираем дубликаты
        validKeys = [...new Set(validKeys)];

        if (validKeys.length === 0) {
            return res.status(500).json({ error: 'API Key не настроен. Добавьте GOOGLE_API_KEY в переменные окружения Vercel.' });
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

        const callGemini = async (modelName) => {
            const clean = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName;
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${apiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
            );
            if (!resp.ok) {
                const text = await resp.text();
                const status = resp.status;
                const err = new Error(`${status} on ${clean}: ${text.substring(0, 200)}`);
                err.status = status;
                throw err;
            }
            return { data: await resp.json(), model: clean };
        };

        // Расширенная fallback-цепочка: от новейших к самым стабильным
        let fallbackChain = [
            targetModel,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
        ];

        // Убираем дубликаты
        fallbackChain = [...new Set(fallbackChain)];

        let errors = [];

        // Внешний цикл по ключам
        for (let k = 0; k < validKeys.length; k++) {
            const currentApiKey = validKeys[k];
            let isKeyExhausted = false;

            // Внутренний цикл по моделям
            for (let i = 0; i < fallbackChain.length; i++) {
                if (isKeyExhausted) break; // Если текущий ключ мертв/исчерпан для всех моделей, переходим к следующему

                const currentModel = fallbackChain[i];
                try {
                    const resp = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${currentApiKey}`,
                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
                    );

                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                            return res.status(200).json({
                                choices: [{ message: { role: 'assistant', content: data.candidates[0].content.parts[0].text } }],
                                usage: { total_tokens: data.usageMetadata?.totalTokenCount || 0 },
                                model_used: currentModel
                            });
                        } else if (data.error) {
                            if (data.error.code === 404) {
                                console.warn(`[Gemini] Модель ${currentModel} не найдена, пробуем следующую...`);
                                errors.push(`[Key ${k}] 404: Модель ${currentModel} не найдена`);
                            } else if (data.error.code === 429) {
                                console.warn(`[Gemini] Лимит запросов (429) для ключа ${k} + модель ${currentModel}`);
                                errors.push(`[Key ${k}] 429: Лимит запросов для ${currentModel}`);
                                isKeyExhausted = true; // С одним ключом лимит обычно распространяется на все модели, но можем дать шанс следующему ключу
                            } else {
                                throw new Error(data.error.message || JSON.stringify(data.error));
                            }
                        } else {
                            throw new Error('Пустой ответ или неправильный формат от Gemini API: ' + JSON.stringify(data));
                        }
                    } else if (!resp.ok) {
                        const textError = await resp.text();

                        if (resp.status === 404) {
                            console.warn(`[Gemini] Ошибка 404 для ${currentModel} (Key ${k})`);
                            errors.push(`[Key ${k}] 404 для ${currentModel}: ${textError}`);
                        } else if (resp.status === 429) {
                            console.warn(`[Gemini] Лимит 429 для ${currentModel} (Key ${k})`);
                            errors.push(`[Key ${k}] 429 для ${currentModel}: ${textError}`);
                            isKeyExhausted = true; // Переключаемся на следующий ключ
                        } else if (resp.status >= 500) {
                            console.warn(`[Gemini] Ошибка сервера 5xx для ${currentModel} (Key ${k})`);
                            errors.push(`[Key ${k}] 5xx для ${currentModel}: ${textError}`);
                        } else {
                            console.error(`[Gemini] CRITICAL ${resp.status} on ${currentModel} (Key ${k}):`, textError);
                            errors.push(`[Key ${k}] CRITICAL ${resp.status} для ${currentModel}: ${textError}`);
                            const errorObj = new Error(`Google API Error ${resp.status}: ${textError}`);
                            errorObj.status = resp.status;
                            throw errorObj;
                        }
                    }

                } catch (err) {
                    console.warn(`[Gemini] Исключение при вызове ${currentModel} на Key ${k}: ${err.message}`);
                    errors.push(`[Key ${k}] ${currentModel} -> ${err.message || JSON.stringify(err)}`);

                    if (err.status === 400 || err.status === 403) {
                        isKeyExhausted = true; // Ключ невалидный, сразу переходим к следующему ключу
                    }
                }
            }
        }

        return res.status(500).json({ error: `Все модели fallback-цепочки недоступны. Ошибки: ${errors.join(', ')}` });

    } catch (err) {
        console.error('Chat API Error:', err);
        return res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
}
