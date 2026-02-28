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
        const { text, type } = await req.json(); // type: 'task' | 'reward'

        // Получаем ключ от клиента (если пользователь ввел его в настройках)
        const authHeader = req.headers.get('authorization') || '';
        let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '') {
            clientKey = null;
        }

        const envKey = typeof process !== 'undefined' && process.env ? process.env.GOOGLE_API_KEY : null;
        const apiKey = clientKey || envKey;

        if (!apiKey) {
            // Нет ключа — пропускаем валидацию, не блокируем пользователя
            return new Response(JSON.stringify({ valid: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!text || !text.trim()) {
            return new Response(JSON.stringify({ valid: false, reason: 'Текст не может быть пустым' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Быстрая локальная проверка на мусор (до обращения к ИИ)
        const cleaned = text.trim();
        if (cleaned.length < 2) {
            return new Response(JSON.stringify({ valid: false, reason: 'Слишком короткий текст' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Проверка на случайные буквы/цифры
        const allSymbolsPattern = /^[^a-zA-Zа-яА-ЯёЁ]+$/;
        const repeatingPattern = /^(.)\1{2,}$/;
        const keyboardSmashPattern = /^(qwe|asd|zxc|йцу|фыв|ячс|123|qwer|asdf|zxcv)/i;

        if (allSymbolsPattern.test(cleaned) || repeatingPattern.test(cleaned) || keyboardSmashPattern.test(cleaned)) {
            return new Response(JSON.stringify({
                valid: false,
                reason: 'Похоже на случайный набор символов. Введите осмысленное название.'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

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

        // Функция вызова модели
        const callGemini = async (modelName) => {
            const clean = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName;
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );
            if (!resp.ok) {
                const text = await resp.text();
                const status = resp.status;
                const err = new Error(`${status} on ${clean}: ${text.substring(0, 200)}`);
                err.status = status;
                throw err;
            }
            return resp.json();
        };

        // Fallback-цепочка моделей
        const modelsToTry = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];
        let data = null;
        let lastError = null;

        for (const m of modelsToTry) {
            try {
                data = await callGemini(m);
                break;
            } catch (e) {
                lastError = e;
                if (e.status === 401 || e.status === 403) break; // Неверный ключ
                console.warn(`Validate fallback: Model ${m} failed:`, e.message);
                continue;
            }
        }

        if (!data) {
            // При ошибке — пропускаем валидацию, не блокируем пользователя
            console.warn('All validation models failed, passing through');
            return new Response(JSON.stringify({ valid: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Извлекаем JSON из ответа
        const jsonMatch = aiText.match(/\{[^}]+\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ valid: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.warn('Validation error with AI fallback to valid=true:', error.message);
        return new Response(JSON.stringify({ valid: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
