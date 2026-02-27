export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { text, type } = req.body; // type: 'task' | 'reward'

    // Получаем ключ от клиента (если пользователь ввел его в настройках)
    const authHeader = req.headers.authorization || '';
    let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '' || clientKey === 'AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc') {
        clientKey = null;
    }

    const apiKey = clientKey || process.env.GOOGLE_API_KEY;

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
    const repeatingPattern = /^(.)\1{2,}$/; // Три одинаковых символа подряд ("ааа")
    const keyboardSmashPattern = /^(qwe|asd|zxc|йцу|фыв|ячс|123|qwer|asdf|zxcv)/i;

    if (allSymbolsPattern.test(cleaned) || repeatingPattern.test(cleaned) || keyboardSmashPattern.test(cleaned)) {
        return res.status(200).json({
            valid: false,
            reason: 'Похоже на случайный набор символов. Введите осмысленное название.'
        });
    }

    try {
        const prompt = `Ты строгий валидатор ввода. Пользователь вводит название для ${type === 'reward' ? 'награды' : 'задачи'}.

Текст: "${cleaned}"

Ответь СТРОГО в JSON формате:
{"valid": true} — если текст осмысленный (названия действий, предметов, целей, даже из 1 слова, например "Кофе", "Сон", "Книга").
{"valid": false, "reason": "причина"} — если это случайный набор букв ("asdasd", "ghjghj", "пвкпв", "вфыв"), цифр, мусор или оскорбление.

КРИТИЧЕСКИ ВАЖНО: 
- Отсекай любой текст, который выглядит как случайные нажатия по клавиатуре (keyboard smash). 
- Если это не существующее слово или не аббревиатура - отклоняй.
- Короткие реальные слова ("чай", "бег") - одобряй.
- Отвечай ТОЛЬКО JSON объектом, без лишнего текста.`;

        // Используем нативный Google REST API (как в chat.js)
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 100
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            console.warn('Validation AI request failed:', response.status);
            return res.status(200).json({ valid: true }); // При ошибке — пропускаем
        }

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Извлекаем JSON из ответа
        const jsonMatch = aiText.match(/\{[^}]+\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return res.status(200).json(result);
        }

        return res.status(200).json({ valid: true });

    } catch (error) {
        console.warn('Validation error with AI fallback to valid=true:', error.message);
        return res.status(200).json({ valid: true }); // При ошибке — пропускаем
    }
}
