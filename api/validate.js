import { getAIClient } from './_lib/ai-client.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { text, type } = req.body; // type: 'task' | 'reward'

    const authHeader = req.headers.authorization || '';
    let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '' || clientKey === 'AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc') {
        clientKey = null;
    }

    let aiClient;
    try {
        aiClient = getAIClient(clientKey);
    } catch (err) {
        // Если нет ключа — пропускаем валидацию
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
- Короткие реальные слова ("чай", "бег") - одобряй.`;

        const response = await aiClient.chat.completions.create({
            model: "gemini-2.0-flash", // используем легкую быструю модель
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 100,
            response_format: { type: "json_object" } // Требуем строгий JSON
        });

        const aiText = response.choices?.[0]?.message?.content || '';

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
