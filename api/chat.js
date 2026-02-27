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

    let aiClient;
    try {
        aiClient = getAIClient(clientKey);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    try {
        // Формируем историю чата для OpenAI SDK (role: 'system', 'user', 'assistant')
        const openAiMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        // Очищаем имя модели и формируем список для попыток
        const targetModel = model || 'gemini-2.0-flash';
        const cleanModelName = targetModel.startsWith('models/') ? targetModel.replace('models/', '') : targetModel;

        const modelsToTry = [cleanModelName, 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];

        let lastError = null;
        let successData = null;

        for (const modelToTry of [...new Set(modelsToTry)]) {
            try {
                // Вызываем ИИ через официальный SDK
                const response = await aiClient.chat.completions.create({
                    model: modelToTry,
                    messages: openAiMessages,
                    temperature: temperature,
                    max_tokens: max_tokens,
                });

                successData = response;
                break; // Успех
            } catch (err) {
                lastError = err;
                console.warn(`Провал на модели ${modelToTry}:`, err.message);
                if (err.status === 400) {
                    // Если 400 Bad Request (например неверный формат) - нет смысла пробовать другие
                    break;
                }
            }
        }

        if (!successData) {
            return res.status(500).json({ error: lastError?.message || 'Все доступные модели Google исчерпали квоту' });
        }

        const assistantMessage = successData.choices?.[0]?.message?.content || '';

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
                total_tokens: successData.usage?.total_tokens || 0
            }
        });

    } catch (error) {
        console.error('AI API Error:', error);
        return res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
    }
}
