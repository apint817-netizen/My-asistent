import fetch from 'node-fetch';

const GOOGLE_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Вставьте сюда реальный ключ для теста, если есть, или оставьте пустой для проверки 400/404
const API_KEY = process.env.GOOGLE_API_KEY || '';

async function testAI() {
    console.log("Тестируем запрос аналогичный ResumeView...");

    const body = {
        model: 'gemini-2.0-flash',
        messages: [
            { role: 'system', content: 'Ты карьерный стратег. Проанализируй резюме.' },
            { role: 'user', content: 'ТЕКУЩЕЕ СОСТОЯНИЕ: Ищу работу\n\nРЕЗЮМЕ:\nПрограммист 5 лет.' }
        ],
        temperature: 0.9,
        max_tokens: 4096
    };

    const headers = {
        'Content-Type': 'application/json'
    };

    if (API_KEY) {
        headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    try {
        console.log(`Отправляем POST на ${GOOGLE_OPENAI_BASE}/chat/completions`);
        const res = await fetch(`${GOOGLE_OPENAI_BASE}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text.slice(0, 500)}`);

        if (res.ok) {
            console.log("\nУСПЕХ! ИИ ответил корректно.");
        } else {
            console.error("\nОШИБКА API!");
        }

    } catch (err) {
        console.error("Критическая ошибка fetch:", err);
    }
}

testAI();
