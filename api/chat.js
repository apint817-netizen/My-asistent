export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { model, messages, temperature = 0.9, max_tokens = 2048 } = req.body;

    // Получаем ключ от клиента (если пользователь ввел его в настройках)
    const authHeader = req.headers.authorization || '';
    let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '' || clientKey === 'AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc') {
        clientKey = null;
    }

    const apiKey = clientKey || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Google API Key не предоставлен клиентом и не настроен на сервере Vercel.'
        });
    }

    let targetModel = model || 'gemini-2.5-flash';

    try {
        // 1. Системный промпт
        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

        // 2. Формируем историю чата для Google
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => {
                const role = m.role === 'assistant' ? 'model' : 'user';
                if (Array.isArray(m.content)) {
                    const parts = m.content.map(part => {
                        if (part.type === 'text') return { text: part.text };
                        if (part.type === 'image_url' && part.image_url?.url) {
                            const dataUrl = part.image_url.url;
                            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                            if (match) {
                                return { inlineData: { mimeType: match[1], data: match[2] } };
                            }
                            return { text: '[Изображение: не удалось обработать]' };
                        }
                        return { text: JSON.stringify(part) };
                    });
                    return { role, parts };
                }
                return { role, parts: [{ text: m.content }] };
            });

        // 3. Тело запроса
        const body = {
            contents,
            generationConfig: { temperature, maxOutputTokens: max_tokens }
        };

        if (systemInstruction) {
            body.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        // ===== ВЫЗОВ GOOGLE API С FALLBACK =====

        const callGemini = async (modelName) => {
            const cleanName = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName;
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${cleanName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`${response.status} on ${cleanName}: ${text}`);
            }
            return { data: await response.json(), modelUsed: cleanName };
        };

        // Список моделей для попытки (реально доступные на API ключе!)
        const cleanModelName = targetModel.startsWith('models/') ? targetModel.replace('models/', '') : targetModel;
        let modelsToTry = [cleanModelName, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

        // Убираем дубликаты
        modelsToTry = [...new Set(modelsToTry)];

        let lastError;
        let success = false;
        let resultData;
        let usedModel;

        for (const modelName of modelsToTry) {
            try {
                const result = await callGemini(modelName);
                resultData = result.data;
                usedModel = result.modelUsed;
                success = true;
                break;
            } catch (e) {
                lastError = e;
                console.warn(`Model ${modelName} failed:`, e.message?.substring(0, 100));
                if (e.message.includes('400')) break; // Неверный ключ
                continue;
            }
        }

        // Крайний случай: динамическое обнаружение
        if (!success) {
            try {
                const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                if (listRes.ok) {
                    const listData = await listRes.json();
                    const available = (listData.models || [])
                        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                        .map(m => m.name.replace('models/', ''));

                    const bestModel = available.find(m => m.includes('flash')) || available[0];
                    if (bestModel) {
                        const result = await callGemini(bestModel);
                        resultData = result.data;
                        usedModel = result.modelUsed;
                        success = true;
                    }
                }
            } catch (e) {
                lastError = e;
            }
        }

        if (!success) {
            throw lastError || new Error('All Google models failed');
        }

        // 4. Ответ в OpenAI-формате
        const assistantMessage = resultData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({
            choices: [{ message: { role: 'assistant', content: assistantMessage } }],
            usage: { total_tokens: resultData.usageMetadata?.totalTokenCount || 0 },
            model_used: usedModel
        });

    } catch (error) {
        console.error('AI API Error:', error);

        return res.status(500).json({
            error: error.message || 'Внутренняя ошибка сервера',
            debug: { model: targetModel, keyPresent: !!apiKey }
        });
    }
}
