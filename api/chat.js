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

        // Ключ пользователя должен быть ТОЛЬКО в переменных окружения (Vercel)
        const envKey = process.env.GOOGLE_API_KEY || null;
        const apiKey = clientKey || envKey;

        if (!apiKey) {
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

        for (let i = 0; i < fallbackChain.length; i++) {
            const currentModel = fallbackChain[i];
            try {
                const resp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
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
                        } else if (data.error.code === 429) {
                            console.warn(`[Gemini] Лимит запросов (429) для ${currentModel}, пробуем следующую...`);
                        } else {
                            throw new Error(data.error.message || JSON.stringify(data.error));
                        }
                    } else {
                        throw new Error('Пустой ответ или неправильный формат от Gemini API: ' + JSON.stringify(data));
                    }
                } else if (!resp.ok) {
                    const textError = await resp.text();

                    if (resp.status === 404) {
                        console.warn(`[Gemini] Ошибка 404 для ${currentModel}, пробуем fallback...`);
                    } else if (resp.status === 429) {
                        console.warn(`[Gemini] Лимит 429 для ${currentModel}, пробуем fallback...`);
                    } else if (resp.status >= 500) {
                        console.warn(`[Gemini] Ошибка сервера 5xx для ${currentModel}, пробуем fallback...`);
                    } else {
                        const errorMsg = `Google API Error ${resp.status}: ${textError}`;
                        const errorObj = new Error(errorMsg);
                        errorObj.status = resp.status;
                        throw errorObj;
                    }
                }

            } catch (err) {
                console.warn(`[Gemini] Исключение при вызове ${currentModel}: ${err.message}`);
                if (err.status === 400 || err.status === 403 || i === fallbackChain.length - 1) throw err;
            }
        }

        return res.status(500).json({ error: 'Все модели fallback-цепочки недоступны.' });

    } catch (err) {
        console.error('Chat API Error:', err);
        return res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
}
