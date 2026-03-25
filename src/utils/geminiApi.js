/**
 * Единый хелпер для вызова ИИ.
 * В продакшене (Vercel) вся магия (fallback моделей, ключи) происходит на бекенде в /api/chat.
 * При локальной разработке (`npm run dev`) делаем прямой запрос в Google, 
 * так как локального Vercel сервера под `/api` нет.
 */
import { useStore } from '../store/useStore';

const GOOGLE_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Стабильная модель по умолчанию (доступна на API ключе Vercel)
const STABLE_MODEL = 'gemini-2.0-flash';

// Подставляет стабильную модель если не задана
function sanitizeModel(model) {
    if (!model) return STABLE_MODEL;
    return model;
}

export async function callAI({ baseUrl, apiKey, model, systemPrompt, history, userMessage, maxTokens, attachments }) {
    // Принудительно заменяем нестабильные модели
    model = sanitizeModel(model);

    const isDevelopment = import.meta.env.DEV;

    // Формируем контент пользователя
    let userContent;
    if (attachments && attachments.length > 0) {
        // Мультимодальный формат — массив частей
        const parts = [];
        // Текст
        if (userMessage) {
            parts.push({ type: 'text', text: userMessage });
        }
        // Вложения
        for (const att of attachments) {
            if (att.type === 'image') {
                parts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${att.mimeType};base64,${att.base64}`
                    }
                });
            } else {
                // Текстовые файлы — добавляем как текст
                parts.push({ type: 'text', text: `\n\n[Файл: ${att.name}]\n${att.textContent || '(не удалось прочитать)'}` });
            }
        }
        userContent = parts;
    } else {
        userContent = userMessage;
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.content
        })),
        { role: 'user', content: userContent }
    ];

    const body = {
        model: model || 'gemini-2.0-flash',
        messages,
        temperature: 0.9,
        max_tokens: maxTokens || 2048
    };

    const headers = {
        'Content-Type': 'application/json'
    };

    // Отправляем ключ только если он реально задан пользователем (не пустая строка)
    if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
        let res;

        if (baseUrl === GOOGLE_OPENAI_BASE && isDevelopment) {
        // Локальная разработка: бьем НАПРЯМУЮ в Native REST API 구гла (так как OpenAI endpoint глючит с длинными текстами)
        // Чтобы не залипал демо-ключ, фильтруем его
        let keyToUse = apiKey;
        if (!keyToUse) {
            console.warn("ВНИМАНИЕ: Используется пустой ключ локально. Запросы могут упасть.");
        }

        // Формируем payload в нативном формате Google:
        const nativeContents = messages.filter(m => m.role !== 'system').map(m => {
            const role = m.role === 'assistant' ? 'model' : 'user';
            const parts = Array.isArray(m.content)
                ? m.content.map(p => {
                    if (p.type === 'text') return { text: p.text };
                    if (p.type === 'image_url') {
                        const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
                    }
                    return { text: JSON.stringify(p) };
                })
                : [{ text: m.content }];
            return { role, parts };
        });

        const nativeBody = {
            contents: nativeContents,
            generationConfig: { temperature: 0.9, maxOutputTokens: maxTokens || 2048 }
        };

        if (systemPrompt) {
            nativeBody.system_instruction = { parts: [{ text: systemPrompt }] };
        }

        const modelToUse = model || 'gemini-2.0-flash';
        const cleanModel = modelToUse.startsWith('models/') ? modelToUse.replace('models/', '') : modelToUse;

        try {
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${keyToUse}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nativeBody)
            });

            // Нативный парсинг
            if (!res.ok) {
                const errorText = await res.text();
                let parsedError = errorText;
                try { parsedError = JSON.parse(errorText).error?.message || errorText; } catch (e) { }
                throw new Error(`Google API Error ${res.status} on ${cleanModel}: ${parsedError}`);
            }

            const data = await res.json();

            if (data.usageMetadata?.totalTokenCount) {
                useStore.getState().addAiTokensUsed(data.usageMetadata.totalTokenCount);
            }

            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error('Пустой ответ от ИИ');
            useStore.getState().setLastAiProvider('google');
            return textResponse;
        } catch (err) {
            console.warn("Локальный Google API недоступен или исчерпан лимит:", err.message);

            const proxyConf = useStore.getState().proxyParams;
            if (!proxyConf || !proxyConf.url) {
                throw err;
            }

            console.warn(`🔄 Переключаемся на локальный прокси (${proxyConf.url})...`);

            const fallbackRes = await fetch(`${proxyConf.url.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${proxyConf.key || 'sk-antigravity'}`
                },
                body: JSON.stringify({ ...body, model: proxyConf.model || 'gemini-2.0-flash' })
            });

            if (!fallbackRes.ok) {
                // Если прокси тоже не работает, прокидываем оригинальную ошибку или ошибку прокси
                throw err;
            }

            const fallbackData = await fallbackRes.json();

            if (fallbackData.usage?.total_tokens) {
                useStore.getState().addAiTokensUsed(fallbackData.usage.total_tokens);
            }

            if (fallbackData.choices && fallbackData.choices[0]?.message?.content) {
                return fallbackData.choices[0].message.content;
            }
            throw err;
        }

    } else if (baseUrl === GOOGLE_OPENAI_BASE && !isDevelopment) {
        // Продакшен: бьем в наш надежный сервер Vercel (/api/chat.js с Fallbacks)
        // Для Capacitor (mobile) используем VITE_API_URL
        const baseUrl = import.meta.env.VITE_API_URL || '';
        // КРИТИЧЕСКИ ВАЖНО: Удаляем клиентский ключ из заголовков перед отправкой на сервер,
        // чтобы предотвратить 403 ошибку от старого ключа из localStorage.
        // Сервер берет свежий ключ из process.env.GOOGLE_API_KEY
        const serverHeaders = { ...headers };
        delete serverHeaders['Authorization'];

        res = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: serverHeaders,
            body: JSON.stringify(body)
        });
    } else {
        // Локальный прокси: бьем по заданному пользователем URL
        const customUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
        res = await fetch(customUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
    }

    if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `HTTP ${res.status}`;
        try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error?.message || errorJson.error || errorJson.message || errorText.slice(0, 300);
        } catch {
            errorMsg = errorText.slice(0, 300);
        }
        throw new Error(errorMsg);
    }

    const data = await res.json();

    if (data.usage?.total_tokens) {
        useStore.getState().addAiTokensUsed(data.usage.total_tokens);
    }
    
    if (data.keys_count) {
        useStore.getState().setAiKeysCount(data.keys_count);
    }

    if (data.ai_provider) {
        useStore.getState().setLastAiProvider(data.ai_provider);
    }

    if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
    }

        throw new Error('Пустой ответ от ИИ');
    } catch (err) {
        console.warn("Локальная ошибка или лимит исчерпан:", err.message);
        if (userMessage && typeof userMessage === 'string') {
            console.log("🚀 Активирована ОФЛАЙН ИИ-Заглушка!");
            useStore.getState().setLastAiProvider('offline');
            return fallbackToOfflineStub(userMessage);
        }
        throw err;
    }
}

export const GOOGLE_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Быстрая, стабильная' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Мощная (с thinking)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Продвинутая модель' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', description: 'Быстрая и легкая' }
];

export const PROXY_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Через прокси' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Через прокси' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI' }
];

export function fallbackToOfflineStub(userMessage) {
    const msg = userMessage.toLowerCase();
    
    // Извлечь текст после ключевых слов
    const extractTitle = (text, keywords) => {
        let title = text;
        keywords.forEach(kw => { title = title.replace(new RegExp(kw, 'gi'), ''); });
        title = title.replace(/^[\s,.:;\-]+/, '').replace(/[\s,.:;\-]+$/, '').trim();
        return title;
    };

    // Определение даты из текста
    const parseFutureDate = (text) => {
        const today = new Date();
        if (/завтра/i.test(text)) {
            const d = new Date(today); d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        }
        if (/послезавтра/i.test(text)) {
            const d = new Date(today); d.setDate(d.getDate() + 2);
            return d.toISOString().split('T')[0];
        }
        const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) return dateMatch[1];
        return null;
    };

    // --- ДОБАВЛЕНИЕ ЗАДАЧИ ---
    if (msg.includes('добавь') || msg.includes('создай') || msg.includes('напомни') || msg.includes('запиши')) {
        // Проверяем — это награда?
        if (msg.includes('наград') || msg.includes('приз')) {
            let title = extractTitle(userMessage, ['добавь', 'создай', 'награду', 'награда', 'приз', 'пожалуйста', 'мне']);
            if (!title) title = 'Новая награда (офлайн)';
            const costMatch = msg.match(/(\d+)\s*(очк|балл|стоимост)/);
            const cost = costMatch ? parseInt(costMatch[1], 10) : 100;
            return `Предложила награду! Подтверди в окне 👆 [ADD_REWARD: "${title}" | ${cost}]`;
        }

        // Проверяем — это задача на дату?
        const futureDate = parseFutureDate(msg);
        let title = extractTitle(userMessage, ['добавь', 'создай', 'сделай', 'напомни', 'запиши', 'задачу', 'привычку', 'цель', 'мне', 'пожалуйста', 'завтра', 'послезавтра', 'на']);
        if (!title) title = 'Новая задача (офлайн)';

        if (futureDate) {
            return `Добавляю на ${futureDate}! Подтверди в окне 👆 [ADD_CALENDAR_TASK: "${title}" | 15 | "${futureDate}"]`;
        }

        // Обычная задача на сегодня
        return `Предложила задачу! Подтверди в окне 👆 [ADD_TASK: "${title}" | 15]`;
    }

    // --- ВЫПОЛНЕНИЕ ЗАДАЧИ ---
    if (msg.includes('выполн') || msg.includes('сделал') || msg.includes('готово') || msg.includes('отмет')) {
        let ref = extractTitle(userMessage, ['выполнил', 'выполнена', 'отметь', 'сделал', 'готово', 'задачу', 'задача']);
        if (!ref) ref = '#1';
        return `Отмечаю выполненной! ✅ [COMPLETE_TASK: "${ref}"]`;
    }

    // --- УДАЛЕНИЕ ---
    if (msg.includes('удали')) {
        if (msg.includes('наград') || msg.includes('приз')) {
            let ref = extractTitle(userMessage, ['удали', 'награду', 'награда', 'приз']);
            if (!ref) return 'Укажите название или номер награды для удаления.';
            return `Удаляю награду! [DELETE_REWARD: "${ref}"]`;
        }
        let ref = extractTitle(userMessage, ['удали', 'задачу', 'задача']);
        if (!ref) return 'Укажите название или номер задачи для удаления.';
        return `Удаляю задачу! [DELETE_TASK: "${ref}"]`;
    }

    // --- ПОКУПКА НАГРАДЫ ---
    if (msg.includes('купи') || msg.includes('потрать') || msg.includes('хочу наград')) {
        let ref = extractTitle(userMessage, ['купи', 'потрать', 'на', 'хочу', 'награду', 'наград']);
        if (!ref) return 'Укажите название награды для покупки.';
        return `Покупаю! 🎁 [BUY_REWARD: "${ref}"]`;
    }

    // --- ИЗМЕНЕНИЕ ОЧКОВ ---
    if (msg.includes('измени') || msg.includes('поставь') || msg.includes('стоимость')) {
        const pointsMatch = msg.match(/(\d+)\s*(очк|балл|стоимост)/);
        let ref = extractTitle(userMessage, ['измени', 'поставь', 'стоимость', 'задачу', 'задача', 'количество', 'очков']);
        if (pointsMatch && ref) {
            return `Меняю стоимость! [EDIT_TASK_POINTS: "${ref}" | ${pointsMatch[1]}]`;
        }
    }

    // Дефолтные разговорные ответы
    const stubs = [
        "⚡ Сейчас я работаю в офлайн-режиме, но могу:\n• Добавить задачу — \"Добавь задачу ...\"\n• Добавить награду — \"Добавь награду ...\"\n• Удалить задачу — \"Удали задачу ...\"\n• Отметить выполненной — \"Выполнил задачу ...\"\nПросто напишите команду!",
        "🔌 Облачные серверы ИИ сейчас недоступны, но я всё ещё функционирую! Попробуйте:\n• \"Добавь задачу почитать книгу\"\n• \"Запиши на завтра тренировку\"\n• \"Удали задачу #2\"",
        "📡 Связь с облаком потеряна, но система продолжает работать! Доступные команды:\n• Добавить/удалить задачи и награды\n• Отметить задачу выполненной\n• Запланировать на будущую дату"
    ];
    return stubs[Math.floor(Math.random() * stubs.length)];
}

export { GOOGLE_OPENAI_BASE };
