import { getAIClient } from './_lib/ai-client.js';

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

    // Сначала пытаемся использовать ключ клиента, если его нет - fallback на серверный ключ Vercel
    const apiKey = clientKey || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'Google API Key не предоставлен клиентом и не настроен на сервере Vercel.'
        });
    }

    try {
        // 1. Ищем системный промпт
        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

        // 2. Формируем историю чата для Google (role: 'user' или 'model')
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => {
                const role = m.role === 'assistant' ? 'model' : 'user';
                // Мультимодальный контент (массив частей)
                if (Array.isArray(m.content)) {
                    const parts = m.content.map(part => {
                        if (part.type === 'text') {
                            return { text: part.text };
                        } else if (part.type === 'image_url' && part.image_url?.url) {
                            // Извлекаем base64 из data:URI
                            const dataUrl = part.image_url.url;
                            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                            if (match) {
                                return {
                                    inlineData: {
                                        mimeType: match[1],
                                        data: match[2]
                                    }
                                };
                            }
                            return { text: '[Изображение: не удалось обработать]' };
                        }
                        return { text: JSON.stringify(part) };
                    });
                    return { role, parts };
                }
                // Обычный текстовый контент
                return {
                    role,
                    parts: [{ text: m.content }]
                };
            });

        // 3. Собираем тело запроса
        const body = {
            contents,
            generationConfig: {
                temperature,
                maxOutputTokens: max_tokens
            }
        };

        // Добавляем system_instruction только если он есть
        if (systemInstruction) {
            body.system_instruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        // 4. Очищаем имя модели и формируем список для попыток
        const targetModel = model || 'gemini-2.0-flash';
        const cleanModelName = targetModel.startsWith('models/') ? targetModel.replace('models/', '') : targetModel;

        const getAvailableModels = async () => {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                if (!res.ok) return [];
                const data = await res.json();

                // Фильтруем только те, что умеют generateContent
                const validModels = (data.models || [])
                    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));

                return validModels;
            } catch (e) {
                console.error('Failed to fetch available Google models:', e);
                return [];
            }
        };

        const availableModels = await getAvailableModels();

        // Интеллектуально подбираем приоритет из доступных моделей 
        let modelsToTry = [cleanModelName];

        if (availableModels.length > 0) {
            // Если получили список от Google, добавляем проверенные модели, если они есть в списке
            const priority = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
            const availablePriority = priority.filter(p => availableModels.includes(p) || availableModels.includes('models/' + p));
            modelsToTry.push(...availablePriority);

            // На крайний случай - просто берем первую доступную
            modelsToTry.push(availableModels[0]);
        } else {
            // Fallback, если список получить не удалось
            modelsToTry.push('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro');
        }

        let lastError = null;
        let successData = null;

        for (const modelToTry of [...new Set(modelsToTry)]) {
            try {
                // 5. Вызываем Native Google REST API
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    let parsedError = errorText;
                    try {
                        const json = JSON.parse(errorText);
                        parsedError = json.error?.message || errorText;
                    } catch (e) { }

                    throw new Error(`Google API Error ${response.status} on ${modelToTry}: ${parsedError}`);
                }

                successData = await response.json();
                break; // Успех
            } catch (err) {
                lastError = err;
                console.warn(`Провал на модели ${modelToTry}:`, err.message);
                if (err.message.includes('400')) {
                    // Если 400 Bad Request (например неверный формат ключа) - нет смысла пробовать другие
                    break;
                }
            }
        }

        if (!successData) {
            return res.status(500).json({ error: lastError?.message || 'Все доступные модели Google исчерпали квоту или недоступны' });
        }

        // 6. Формируем ответ, обратно совместимый с OpenAI (чтобы не ломать фронтенд)
        const assistantMessage = successData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({
            choices: [
                {
                    message: {
                        role: 'assistant',
                        content: assistantMessage
                    }
                }
            ],
            usage: {
                total_tokens: successData.usageMetadata?.totalTokenCount || 0
            }
        });

    } catch (error) {
        console.error('AI API Error:', error);
        return res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
    }
}
