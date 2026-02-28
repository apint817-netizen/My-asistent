export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text, type } = req.body; // type: 'task' | 'reward'

        // Получаем ключ от клиента (если пользователь ввел его в настройках)
        const authHeader = req.headers.authorization || '';
        let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '') {
            clientKey = null;
        }

        const envKey = process.env.GOOGLE_API_KEY || null;
        const apiKey = clientKey || envKey;

        if (!apiKey) {
            // Нет ключа — пропускаем валидацию, не блокируем пользователя
            return res.status(200).json({ valid: true });
        }

        if (!text || !text.trim()) {
            return res.status(200).json({ valid: false, reason: 'Текст не может быть пустым' });
        }

        // Быстрая локальная проверка на мусор (до обращения к ИИ)
        const cleaned = text.trim();
        if (cleaned.length < 2) {
            return res.status(200).json({ valid: false, reason: 'Слишком короткий текст' });
        }

        // Проверка на случайные буквы/цифры
        const allSymbolsPattern = /^[^a-zA-Zа-яА-ЯёЁ]+$/;
        const repeatingPattern = /^(.)\1{2,}$/;
        const keyboardSmashPattern = /^(qwe|asd|zxc|йцу|фыв|ячс|123|qwer|asdf|zxcv)/i;

        if (allSymbolsPattern.test(cleaned) || repeatingPattern.test(cleaned) || keyboardSmashPattern.test(cleaned)) {
            return res.status(200).json({
                valid: false,
                reason: 'Похоже на случайный набор символов. Введите осмысленное название.'
            });
        }

        const model = 'gemini-2.0-flash';
        const systemPrompt = `Ты строгий модератор для приложения-планировщика.
Пользователь пытается добавить новый элемент типа: "${type === 'task' ? 'Задача' : 'Награда'}".
Название: "${text}"

Твоя цель: оценить адекватность, безопасность и осмысленность этого названия.

Не пропускай:
1. Бессмысленный набор букв (например, "asdasd", "123123", "ghj").
2. Оскорбления, мат, деструктивный или опасный контент.
3. Слишком короткие неясные слова (например, просто "а", "й").

Формат ответа СТРОГО JSON:
{"valid": true|false, "reason": "Краткая причина отказа, если valid=false, иначе пустая строка"}
Отвечай только JSON-ом, без пояснений.`;

        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 100
            }
        };

        const fallbackChain = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-pro'];

        let lastErrorMsg = '';

        for (let i = 0; i < fallbackChain.length; i++) {
            const currentModel = fallbackChain[i];
            try {
                const resp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    }
                );

                if (resp.ok) {
                    const data = await resp.json();
                    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const jsonMatch = aiText.match(/\{([^}]+)\}/);

                    return res.status(200).json(jsonMatch ? JSON.parse(jsonMatch[0]) : { valid: false, reason: 'Ошибка валидации (неверный формат)' });
                } else {
                    const errorData = await resp.json();
                    if (errorData.error) {
                        if (errorData.error.code === 404) {
                            console.warn(`[Gemini-Validate] Модель ${currentModel} не найдена, пробуем следующую...`);
                            lastErrorMsg = `404: Модель не найдена`;
                        } else if (errorData.error.code === 429) {
                            console.warn(`[Gemini-Validate] Лимит запросов (429) для ${currentModel}, пробуем следующую...`);
                            lastErrorMsg = `429: Лимит запросов`;
                        } else if (errorData.error.code >= 500) {
                            console.warn(`[Gemini-Validate] Ошибка сервера 5xx для ${currentModel}, пробуем следующую...`);
                            lastErrorMsg = `5xx: Ошибка сервера`;
                        } else {
                            const errorMsg = errorData.error.message || JSON.stringify(errorData.error);
                            const errorObj = new Error(errorMsg);
                            errorObj.status = errorData.error.code; // code contains HTTP status like 400
                            throw errorObj;
                        }
                    } else {
                        const errorMsg = `Google API Error ${resp.status}: ${JSON.stringify(errorData)}`;
                        const errorObj = new Error(errorMsg);
                        errorObj.status = resp.status;
                        throw errorObj;
                    }
                }

            } catch (err) {
                console.warn(`[Gemini-Validate] Исключение при вызове ${currentModel}: ${err.message}`);
                lastErrorMsg = err.message || JSON.stringify(err);
                if (err.status === 400 || err.status === 403 || i === fallbackChain.length - 1) throw err;
            }
        }

        return res.status(500).json({ error: `Все модели fallback-цепочки недоступны. Последняя ошибка: ${lastErrorMsg}` });

    } catch (err) {
        console.error('Validate API Error:', err);
        // При ошибке валидатора просто разрешаем создание, чтобы не блокировать UI намертво
        return res.status(200).json({ valid: true });
    }
}
