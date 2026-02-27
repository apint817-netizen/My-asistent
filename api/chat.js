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

    let targetModel = model || 'gemini-1.5-flash';

    try {
        // 1. Ищем системный промпт
        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

        // 2. Формируем историю чата для Google (role: 'user' или 'model')
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

        // ===== ЛОГИКА АВТОВЫБОРА МОДЕЛИ (по образцу FinModel) =====

        // Хелпер: вызов Google Native REST API
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

        // Хелпер: получить список доступных моделей (крайний случай)
        const getAvailableModels = async () => {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
                );
                if (!response.ok) return [];
                const data = await response.json();
                return (data.models || [])
                    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));
            } catch (e) {
                console.error('Failed to list models', e);
                return [];
            }
        };

        // 1) Список моделей для попытки (по приоритету, как в FinModel)
        let modelsToTry = [];

        // Запрошенная модель (если gemini-)
        const cleanModelName = targetModel.startsWith('models/') ? targetModel.replace('models/', '') : targetModel;
        if (cleanModelName.startsWith('gemini-')) {
            modelsToTry.push(cleanModelName);
        }

        // Стабильные фолбеки
        modelsToTry.push('gemini-1.5-flash');
        modelsToTry.push('gemini-1.5-flash-latest');
        modelsToTry.push('gemini-pro');

        // Убираем дубликаты
        modelsToTry = [...new Set(modelsToTry)];

        let lastError;
        let success = false;
        let resultData;
        let usedModel;

        // Первый проход: пробуем по списку
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
                // 404 = модель не найдена, пробуем следующую
                // 429 = квота, тоже пробуем следующую модель
                if (e.message.includes('400')) break; // Неверный ключ - нет смысла
                continue;
            }
        }

        // 2) Крайний случай: Динамическое обнаружение (как в FinModel)
        if (!success) {
            const availableModels = await getAvailableModels();
            console.log('Available models from Google:', availableModels);

            // Приоритет: flash модели, потом pro, потом любая
            const bestModel = availableModels.find(m => m.includes('flash')) ||
                availableModels.find(m => m.includes('pro')) ||
                availableModels[0];

            if (bestModel) {
                try {
                    const result = await callGemini(bestModel);
                    resultData = result.data;
                    usedModel = result.modelUsed;
                    success = true;
                } catch (e) {
                    lastError = e;
                }
            }
        }

        if (!success) {
            throw lastError || new Error('All Google models failed, including dynamically discovered ones.');
        }

        // 4. Формируем ответ (OpenAI-совместимый формат для фронтенда)
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
            debug: {
                model: targetModel,
                keyPresent: !!apiKey,
                keyPrefix: apiKey?.substring(0, 8) + '...'
            }
        });
    }
}
