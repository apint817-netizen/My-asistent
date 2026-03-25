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
    const forcedProvider = useStore.getState().forcedAiProvider || 'auto';

    // Принудительный офлайн-режим
    if (forcedProvider === 'offline') {
        console.log('⚡ Принудительный ОФЛАЙН режим');
        useStore.getState().setLastAiProvider('offline');
        if (userMessage && typeof userMessage === 'string') {
            return fallbackToOfflineStub(userMessage);
        }
        return 'Офлайн-режим активен. Введите команду на русском.';
    }

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
            headers: {
                ...serverHeaders,
                ...(forcedProvider === 'openrouter' ? { 'x-force-openrouter': 'true' } : {})
            },
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
    const msg = userMessage.toLowerCase().trim();
    const { tasks } = useStore.getState();
    const pendingTasks = tasks.filter(t => !t.completed);
    
    // --- Утилита: извлечь «смысловую часть» из команды ---
    // Вместо удаления ключевых слов по одному, ищем конец командной фразы
    const extractAfter = (text, patterns) => {
        for (const p of patterns) {
            const re = new RegExp(p, 'i');
            const m = text.match(re);
            if (m) {
                // Берём всё что после найденного паттерна
                let result = text.slice(m.index + m[0].length).trim();
                // Убираем начальные предлоги и пунктуацию
                result = result.replace(/^[\s,.:;\-—«"]+/, '').replace(/[\s,.:;\-—»"]+$/, '');
                if (result) return result;
            }
        }
        return '';
    };

    // --- Утилита: слово → номер задачи ---
    const wordToNum = (text) => {
        const map = { 'первую': 1, 'первая': 1, 'первый': 1, 'первой': 1, '1': 1,
            'вторую': 2, 'вторая': 2, 'второй': 2, '2': 2,
            'третью': 3, 'третья': 3, 'третий': 3, 'третьей': 3, '3': 3,
            'четвёртую': 4, 'четвертую': 4, 'четвёртый': 4, '4': 4,
            'пятую': 5, 'пятая': 5, 'пятый': 5, '5': 5,
            'последнюю': -1, 'последняя': -1, 'последний': -1 };
        const lower = text.toLowerCase().trim();
        for (const [word, num] of Object.entries(map)) {
            if (lower.includes(word)) return num;
        }
        const hashMatch = lower.match(/#(\d+)/);
        if (hashMatch) return parseInt(hashMatch[1], 10);
        return 0;
    };

    // --- Определение даты ---
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
        const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10);
            const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3], 10) : parseInt(dateMatch[3], 10)) : today.getFullYear();
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) return isoMatch[1];
        return null;
    };

    // ==================== ДОБАВЛЕНИЕ ====================
    if (msg.includes('добавь') || msg.includes('создай') || msg.includes('напомни') || msg.includes('запиши')) {
        // Награда
        if (msg.includes('наград') || msg.includes('приз')) {
            const title = extractAfter(userMessage, [
                'добавь\\s+награду\\s+', 'создай\\s+награду\\s+',
                'добавь\\s+приз\\s+', 'создай\\s+приз\\s+'
            ]) || 'Новая награда';
            const costMatch = msg.match(/(\d+)\s*(очк|балл|стоимост|ок\b)/);
            const cost = costMatch ? parseInt(costMatch[1], 10) : 100;
            return `Предложила награду! Подтверди в появившемся окне 👆\n[ADD_REWARD: "${title}" | ${cost}]`;
        }

        // Задача — извлекаем дату и название
        const futureDate = parseFutureDate(msg);
        
        // Паттерны для извлечения названия задачи
        let title = extractAfter(userMessage, [
            'добавь\\s+задачу\\s+',
            'создай\\s+задачу\\s+',
            'запиши\\s+(?:на\\s+(?:завтра|послезавтра|\\d+[./]\\d+[./]?\\d*)\\s+)?',
            'напомни\\s+(?:мне\\s+)?',
            'добавь\\s+', 'создай\\s+'
        ]);
        
        // Убираем дату из названия если она в конце или начале
        if (title) {
            title = title.replace(/\s*(?:на\s+)?(?:завтра|послезавтра)\s*/gi, '').trim();
            title = title.replace(/\s*(?:на\s+)?\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*/g, '').trim();
            title = title.replace(/\s*\d{4}-\d{2}-\d{2}\s*/g, '').trim();
        }
        if (!title) title = 'Новая задача';

        if (futureDate) {
            return `Добавляю на ${futureDate}! Подтверди в появившемся окне 👆\n[ADD_CALENDAR_TASK: "${title}" | 15 | "${futureDate}"]`;
        }

        return `Предложила задачу! Подтверди в появившемся окне 👆\n[ADD_TASK: "${title}" | 15]`;
    }

    // ==================== ВЫПОЛНЕНИЕ ====================
    if (msg.includes('выполн') || msg.includes('сделал') || msg.includes('готово') || msg.includes('отмет')) {
        // Пробуем найти номер задачи по словам
        const num = wordToNum(msg);
        if (num === -1 && pendingTasks.length > 0) {
            // Последняя
            const task = pendingTasks[pendingTasks.length - 1];
            return `Отмечаю выполненной! ✅\n[COMPLETE_TASK: "${task.id}"]`;
        }
        if (num > 0 && num <= pendingTasks.length) {
            const task = pendingTasks[num - 1];
            return `Отмечаю «${task.title}» выполненной! ✅\n[COMPLETE_TASK: "${task.id}"]`;
        }
        // Пробуем найти по названию
        const ref = extractAfter(userMessage, [
            'выполнил\\s+задачу\\s+', 'выполнила\\s+задачу\\s+',
            'отметь\\s+(?:задачу\\s+)?', 'сделал\\s+', 'готово\\s+'
        ]);
        if (ref) {
            // Ищем задачу по частичному совпадению
            const found = pendingTasks.find(t => t.title.toLowerCase().includes(ref.toLowerCase()));
            if (found) {
                return `Отмечаю «${found.title}» выполненной! ✅\n[COMPLETE_TASK: "${found.id}"]`;
            }
            return `Задачу «${ref}» не удалось найти среди незавершённых. Проверьте название или используйте «Отметь первую задачу».`;
        }
        if (pendingTasks.length > 0) {
            // По умолчанию — первая незавершённая
            const task = pendingTasks[0];
            return `Отмечаю «${task.title}» выполненной! ✅\n[COMPLETE_TASK: "${task.id}"]`;
        }
        return 'Нет незавершённых задач для отметки!';
    }

    // ==================== УДАЛЕНИЕ ====================
    if (msg.includes('удали')) {
        if (msg.includes('наград') || msg.includes('приз')) {
            const ref = extractAfter(userMessage, ['удали\\s+награду\\s+', 'удали\\s+приз\\s+']);
            if (!ref) return 'Укажите название награды для удаления.';
            return `Удаляю награду!\n[DELETE_REWARD: "${ref}"]`;
        }
        const num = wordToNum(msg);
        if (num > 0 && num <= pendingTasks.length) {
            const task = pendingTasks[num - 1];
            return `Удаляю «${task.title}»!\n[DELETE_TASK: "${task.id}"]`;
        }
        const ref = extractAfter(userMessage, ['удали\\s+задачу\\s+', 'удали\\s+']);
        if (!ref) return 'Укажите название или номер задачи для удаления.';
        return `Удаляю задачу!\n[DELETE_TASK: "${ref}"]`;
    }

    // ==================== ПОКУПКА ====================
    if (msg.includes('купи') || msg.includes('потрать') || msg.includes('хочу наград')) {
        const ref = extractAfter(userMessage, ['купи\\s+', 'потрать\\s+на\\s+', 'хочу\\s+награду\\s+']);
        if (!ref) return 'Укажите название награды для покупки.';
        return `Покупаю! 🎁\n[BUY_REWARD: "${ref}"]`;
    }

    // ==================== ИЗМЕНЕНИЕ ОЧКОВ ====================
    if (msg.includes('измени') || msg.includes('поставь') || msg.includes('стоимость')) {
        const pointsMatch = msg.match(/(\d+)\s*(очк|балл|стоимост)/);
        const ref = extractAfter(userMessage, ['измени\\s+(?:стоимость\\s+)?(?:задачи?\\s+)?', 'поставь\\s+']);
        if (pointsMatch && ref) {
            return `Меняю стоимость!\n[EDIT_TASK_POINTS: "${ref}" | ${pointsMatch[1]}]`;
        }
    }

    // ==================== ИНФОРМАЦИЯ ====================
    if (msg.includes('задач') && (msg.includes('покажи') || msg.includes('список') || msg.includes('какие') || msg.includes('что'))) {
        if (pendingTasks.length === 0) {
            return 'У вас нет незавершённых задач! 🎉 Добавьте новую: «Добавь задачу ...»';
        }
        const list = pendingTasks.map((t, i) => `${i + 1}. ${t.title} (${t.value} очк.)`).join('\n');
        return `📋 Ваши незавершённые задачи:\n${list}\n\nМожете сказать «Отметь первую задачу» для выполнения.`;
    }

    // ==================== ДЕФОЛТ ====================
    const stubs = [
        `⚡ Я работаю в офлайн-режиме, но могу помочь!\n\n📋 Ваши задачи: ${pendingTasks.length} незавершённых\n\nДоступные команды:\n• «Добавь задачу ...» — создать задачу\n• «Запиши на завтра ...» — на будущую дату\n• «Отметь первую задачу» — выполнить\n• «Удали задачу ...» — удалить\n• «Покажи задачи» — список`,
        `🔌 Облачный ИИ недоступен, но я функционирую!\n\nПримеры команд:\n• «Добавь задачу почитать книгу»\n• «Отметь вторую задачу»\n• «Запиши на завтра тренировку»`,
        `📡 Связь с облаком потеряна. Офлайн-режим активен!\n\nНезавершённых задач: ${pendingTasks.length}\nПопробуйте: «Добавь задачу ...» или «Отметь первую задачу»`
    ];
    return stubs[Math.floor(Math.random() * stubs.length)];
}

export { GOOGLE_OPENAI_BASE };
