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
    const { tasks, rewards } = useStore.getState();
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    // ═══════════════════════════════════════════════
    // УТИЛИТЫ
    // ═══════════════════════════════════════════════

    // String-based извлечение: ищем первую из фраз в тексте, берём всё что после
    const extractAfterPhrase = (text, phrases) => {
        const lower = text.toLowerCase();
        for (const phrase of phrases) {
            const idx = lower.indexOf(phrase.toLowerCase());
            if (idx !== -1) {
                let result = text.slice(idx + phrase.length).trim();
                result = result.replace(/^[\s,.:;\-—«"]+/, '').replace(/[\s,.:;\-—»"]+$/, '');
                if (result) return result;
            }
        }
        return '';
    };

    // Очистка названия от служебных слов
    const cleanTitle = (title) => {
        if (!title) return '';
        let t = title;
        // Убираем «задачу», «задача», «привычку», «цель» в начале
        t = t.replace(/^(задачу|задача|задач|привычку|привычка|цель)\s+/i, '');
        // Убираем «на каждый день», «каждый день», «ежедневно» (переносим в контекст, не в название)
        t = t.replace(/\s*(?:на\s+)?(?:каждый\s+день|ежедневно)\s*/gi, ' ');
        // Убираем «пожалуйста», «мне», «себе» в начале
        t = t.replace(/^(?:пожалуйста|мне|себе)\s+/i, '');
        return t.trim();
    };

    // Порядковое числительное → номер
    const wordToNum = (text) => {
        const map = {
            'первую': 1, 'первая': 1, 'первый': 1, 'первой': 1,
            'вторую': 2, 'вторая': 2, 'второй': 2, 'второе': 2,
            'третью': 3, 'третья': 3, 'третий': 3, 'третьей': 3,
            'четвёртую': 4, 'четвертую': 4, 'четвёртый': 4, 'четвертый': 4,
            'пятую': 5, 'пятая': 5, 'пятый': 5, 'пятое': 5,
            'шестую': 6, 'шестая': 6, 'шестой': 6,
            'последнюю': -1, 'последняя': -1, 'последний': -1, 'последнее': -1
        };
        const lower = text.toLowerCase();
        for (const [word, num] of Object.entries(map)) {
            // Ищем как отдельное слово
            const re = new RegExp('(?:^|\\s)' + word + '(?:\\s|$|[,!?.])', 'i');
            if (re.test(lower)) return num;
        }
        const hashMatch = lower.match(/#(\d+)/);
        if (hashMatch) return parseInt(hashMatch[1], 10);
        return 0;
    };

    // Дата — ТОЛЬКО отдельные слова (не внутри «позавтракать»!)
    const parseFutureDate = (text) => {
        const today = new Date();
        // «на завтра» или «завтра» как отдельное слово
        if (/(?:^|\s)(?:на\s+)?завтра(?:\s|$|[,!?.])/i.test(text)) {
            const d = new Date(today); d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        }
        if (/(?:^|\s)(?:на\s+)?послезавтра(?:\s|$|[,!?.])/i.test(text)) {
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

    // Удаление даты из названия
    const removeDateFromTitle = (title) => {
        if (!title) return '';
        let t = title;
        t = t.replace(/\s*(?:на\s+)?(?:завтра|послезавтра)(?:\s|$|[,!?.])/gi, ' ');
        t = t.replace(/\s*(?:на\s+)?\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*/g, ' ');
        t = t.replace(/\s*\d{4}-\d{2}-\d{2}\s*/g, ' ');
        return t.trim();
    };

    // Fuzzy-поиск задачи по тексту
    const findTaskByText = (text, taskList) => {
        if (!text) return null;
        const lower = text.toLowerCase().trim();
        // Убираем слова-маркеры
        const cleaned = lower
            .replace(/\b(задачу?|выполненной|выполнено|готова|сделана|сделано|обратно)\b/g, '')
            .trim();
        if (!cleaned) return null;
        // Точное совпадение
        let found = taskList.find(t => t.title.toLowerCase() === cleaned);
        if (found) return found;
        // Частичное вхождение
        found = taskList.find(t => t.title.toLowerCase().includes(cleaned));
        if (found) return found;
        // Обратное вхождение — cleaned содержит title
        found = taskList.find(t => cleaned.includes(t.title.toLowerCase()));
        if (found) return found;
        // По отдельным словам (хотя бы 2 совпадения)
        const words = cleaned.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            for (const task of taskList) {
                const titleLower = task.title.toLowerCase();
                const score = words.filter(w => titleLower.includes(w)).length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = task;
                }
            }
            if (bestMatch && bestScore >= Math.min(1, words.length)) return bestMatch;
        }
        return null;
    };

    // Fuzzy-поиск награды
    const findRewardByText = (text) => {
        if (!text) return null;
        const lower = text.toLowerCase().trim();
        let found = rewards.find(r => r.title.toLowerCase() === lower);
        if (found) return found;
        found = rewards.find(r => r.title.toLowerCase().includes(lower));
        if (found) return found;
        found = rewards.find(r => lower.includes(r.title.toLowerCase()));
        if (found) return found;
        // По словам
        const words = lower.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            for (const r of rewards) {
                const titleLower = r.title.toLowerCase();
                const score = words.filter(w => titleLower.includes(w)).length;
                if (score > bestScore) { bestScore = score; bestMatch = r; }
            }
            if (bestMatch && bestScore >= 1) return bestMatch;
        }
        return null;
    };

    // ═══════════════════════════════════════════════
    // РАЗГОВОРНЫЕ ОТВЕТЫ (Nova-стиль)
    // ═══════════════════════════════════════════════
    if (/^(привет|здравствуй|хай|хей|hello|hi|йо)\b/i.test(msg)) {
        return `Привет! 💜 Я Nova, твой ассистент. Сейчас я работаю в офлайн-режиме, но всё ещё могу помочь с задачами и наградами!\n\n📋 У тебя ${pendingTasks.length} незавершённых задач.\nПопробуй: «Добавь задачу ...» или «Покажи задачи»`;
    }
    if (/^(спасибо|благодар|thanks)/i.test(msg)) {
        return 'Всегда пожалуйста! 😊 Обращайся, если что-то ещё нужно.';
    }
    if (/как\s+(ты|дела|жизнь|сама)/i.test(msg) || /^(как\s+дела)/i.test(msg)) {
        return `У меня всё отлично! ⚡ Работаю в офлайн-режиме, но полностью функциональна.\n\n📋 У тебя ${pendingTasks.length} задач в работе${completedTasks.length > 0 ? ` и ${completedTasks.length} уже выполненных` : ''}. Чем могу помочь?`;
    }
    if (/^(что ты (умеешь|можешь|делаешь)|помощь|help|команды)/i.test(msg)) {
        return `💜 Вот что я умею в офлайн-режиме:\n\n📝 Задачи:\n• «Добавь задачу ...» — создать новую\n• «Добавь на завтра ...» — на будущую дату\n• «Отметь задачу Х» — выполнить по названию\n• «Отметь первую задачу» — по номеру\n• «Верни задачу Х» — отменить выполнение\n• «Удали задачу ...» — удалить\n• «Покажи задачи» — список\n\n🎁 Награды:\n• «Удали награду ...» — удалить\n• «Купи награду ...» — потратить очки`;
    }

    // ═══════════════════════════════════════════════
    // ДОБАВЛЕНИЕ ЗАДАЧИ / НАГРАДЫ
    // ═══════════════════════════════════════════════
    if (msg.includes('добавь') || msg.includes('создай') || msg.includes('напомни') || msg.includes('запиши')) {
        // --- Награда ---
        if (msg.includes('наград') || msg.includes('приз')) {
            let title = extractAfterPhrase(userMessage, [
                'добавь награду ', 'создай награду ',
                'добавь приз ', 'создай приз '
            ]) || 'Новая награда';
            const costMatch = msg.match(/(\d+)\s*(очк|балл|стоимост|ок\b)/);
            const cost = costMatch ? parseInt(costMatch[1], 10) : 100;
            return `Конечно! Предлагаю добавить награду 🎁\n[ADD_REWARD: "${title}" | ${cost}]`;
        }

        // --- Задача ---
        const futureDate = parseFutureDate(msg);

        let title = extractAfterPhrase(userMessage, [
            'добавь задачу ', 'создай задачу ',
            'добавь на завтра ', 'добавь на послезавтра ',
            'запиши на завтра ', 'запиши на послезавтра ',
            'запиши задачу ', 'напомни мне ', 'напомни ',
            'добавь ', 'создай ', 'запиши '
        ]);

        // Очищаем
        title = cleanTitle(title);
        if (futureDate) {
            title = removeDateFromTitle(title);
            title = cleanTitle(title); // Повторно после удаления даты
        }
        if (!title) title = 'Новая задача';

        if (futureDate) {
            return `Записываю на ${futureDate}! 📅\n[ADD_CALENDAR_TASK: "${title}" | 15 | "${futureDate}"]`;
        }
        return `Отличная задача! ✨\n[ADD_TASK: "${title}" | 15]`;
    }

    // ═══════════════════════════════════════════════
    // ВЫПОЛНЕНИЕ ЗАДАЧИ
    // ═══════════════════════════════════════════════
    if (msg.includes('выполн') || msg.includes('сделал') || msg.includes('готово') || msg.includes('отмет') || msg.includes('закончил')) {
        if (pendingTasks.length === 0) {
            return 'У тебя нет незавершённых задач! 🎉 Все выполнены — отличная работа!';
        }

        // По номеру (первую, вторую...)
        const num = wordToNum(msg);
        if (num === -1) {
            const task = pendingTasks[pendingTasks.length - 1];
            return `Отмечаю «${task.title}» выполненной! 🎉\n[COMPLETE_TASK: "${task.id}"]`;
        }
        if (num > 0 && num <= pendingTasks.length) {
            const task = pendingTasks[num - 1];
            return `Отмечаю «${task.title}» выполненной! 🎉\n[COMPLETE_TASK: "${task.id}"]`;
        }

        // По названию — fuzzy-поиск
        const ref = extractAfterPhrase(userMessage, [
            'выполнил задачу ', 'выполнила задачу ', 'выполнена задача ',
            'отметь задачу ', 'отметь выполненной задачу ',
            'отметь ', 'сделал задачу ', 'сделала задачу ',
            'готово задачу ', 'закончил задачу ', 'закончила задачу '
        ]);
        const task = findTaskByText(ref || msg, pendingTasks);
        if (task) {
            return `Отмечаю «${task.title}» выполненной! 🎉\n[COMPLETE_TASK: "${task.id}"]`;
        }

        // Если не нашли — предложить список
        if (pendingTasks.length <= 5) {
            const list = pendingTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
            return `Не совсем поняла, какую задачу отметить 🤔\n\nВот твои задачи:\n${list}\n\nСкажи, например: «Отметь первую задачу» или назови точное название.`;
        }
        return `Не смогла найти эту задачу 🤔 Попробуй сказать точнее или используй «Отметь первую задачу».`;
    }

    // ═══════════════════════════════════════════════
    // ВЕРНУТЬ / ОТМЕНИТЬ ВЫПОЛНЕНИЕ
    // ═══════════════════════════════════════════════
    if (msg.includes('верни') || msg.includes('отмени') || (msg.includes('обратно') && msg.includes('задач'))) {
        if (completedTasks.length === 0) {
            return 'Нет выполненных задач, которые можно вернуть.';
        }

        const ref = extractAfterPhrase(userMessage, [
            'верни задачу ', 'верни обратно задачу ', 'верни обратно ',
            'отмени выполнение задачи ', 'отмени выполнение ',
            'отмени задачу ', 'верни '
        ]);
        const task = findTaskByText(ref || msg, completedTasks);
        if (task) {
            return `Возвращаю «${task.title}» в незавершённые! ↩️\n[UNCOMPLETE_TASK: "${task.id}"]`;
        }

        // Последняя выполненная
        const lastCompleted = completedTasks[completedTasks.length - 1];
        return `Возвращаю последнюю завершённую «${lastCompleted.title}» обратно! ↩️\n[UNCOMPLETE_TASK: "${lastCompleted.id}"]`;
    }

    // ═══════════════════════════════════════════════
    // УДАЛЕНИЕ
    // ═══════════════════════════════════════════════
    if (msg.includes('удали')) {
        // Награда
        if (msg.includes('наград') || msg.includes('приз')) {
            const ref = extractAfterPhrase(userMessage, [
                'удали награду ', 'удали приз '
            ]);
            if (!ref) return 'Укажи название награды для удаления.';
            const reward = findRewardByText(ref);
            if (reward) {
                return `Удаляю награду «${reward.title}»! 🗑️\n[DELETE_REWARD: "${reward.title}"]`;
            }
            return `Не нашла награду «${ref}» 🤔 Проверь название.`;
        }

        // Задача — по номеру
        const num = wordToNum(msg);
        if (num > 0 && num <= pendingTasks.length) {
            const task = pendingTasks[num - 1];
            return `Удаляю «${task.title}»! 🗑️\n[DELETE_TASK: "${task.id}"]`;
        }
        if (num === -1 && pendingTasks.length > 0) {
            const task = pendingTasks[pendingTasks.length - 1];
            return `Удаляю «${task.title}»! 🗑️\n[DELETE_TASK: "${task.id}"]`;
        }

        // Задача — по названию
        const ref = extractAfterPhrase(userMessage, [
            'удали задачу ', 'удали '
        ]);
        if (ref) {
            const task = findTaskByText(ref, [...pendingTasks, ...completedTasks]);
            if (task) {
                return `Удаляю «${task.title}»! 🗑️\n[DELETE_TASK: "${task.id}"]`;
            }
        }
        return 'Укажи название или номер задачи для удаления.';
    }

    // ═══════════════════════════════════════════════
    // ПОКУПКА НАГРАДЫ
    // ═══════════════════════════════════════════════
    if (msg.includes('купи') || msg.includes('потрать') || msg.includes('хочу наград')) {
        const ref = extractAfterPhrase(userMessage, [
            'купи награду ', 'купи ', 'потрать на ',
            'хочу награду '
        ]);
        if (!ref) return 'Укажи название награды для покупки.';
        const reward = findRewardByText(ref);
        if (reward) {
            return `Покупаю «${reward.title}»! 🎁\n[BUY_REWARD: "${reward.title}"]`;
        }
        return `Не нашла награду «${ref}» 🤔`;
    }

    // ═══════════════════════════════════════════════
    // ИЗМЕНЕНИЕ ОЧКОВ
    // ═══════════════════════════════════════════════
    if (msg.includes('измени') || msg.includes('поставь') || msg.includes('стоимость')) {
        const pointsMatch = msg.match(/(\d+)\s*(очк|балл|стоимост)/);
        const ref = extractAfterPhrase(userMessage, [
            'измени стоимость задачи ', 'измени стоимость ',
            'поставь '
        ]);
        if (pointsMatch && ref) {
            return `Меняю стоимость!\n[EDIT_TASK_POINTS: "${ref}" | ${pointsMatch[1]}]`;
        }
    }

    // ═══════════════════════════════════════════════
    // ПОКАЖИ ЗАДАЧИ
    // ═══════════════════════════════════════════════
    if (msg.includes('задач') && (msg.includes('покажи') || msg.includes('список') || msg.includes('какие') || msg.includes('мои'))) {
        if (pendingTasks.length === 0 && completedTasks.length === 0) {
            return 'У тебя пока нет задач! ✨ Добавь первую: «Добавь задачу ...»';
        }
        let response = '';
        if (pendingTasks.length > 0) {
            const list = pendingTasks.map((t, i) => `${i + 1}. ${t.title} (${t.value} очк.)`).join('\n');
            response += `📋 Незавершённые задачи:\n${list}`;
        }
        if (completedTasks.length > 0) {
            response += `${response ? '\n\n' : ''}✅ Выполнено задач: ${completedTasks.length}`;
        }
        response += '\n\nМожешь сказать «Отметь задачу [название]» для выполнения.';
        return response;
    }

    // ═══════════════════════════════════════════════
    // ДЕФОЛТНЫЙ ОТВЕТ (Nova-стиль)
    // ═══════════════════════════════════════════════
    const novaStubs = [
        `Хм, не совсем поняла тебя 🤔 Сейчас я в офлайн-режиме.\n\n📋 У тебя ${pendingTasks.length} задач, ${rewards.length} наград\n\nПопробуй:\n• «Добавь задачу ...»\n• «Отметь задачу [название]»\n• «Покажи задачи»\n• «Удали награду ...»\n• «Что ты умеешь?»`,
        `Я тебя слышу, но не совсем поняла команду! 😊\n\nВ офлайн-режиме я могу работать с задачами и наградами. Скажи «Что ты умеешь?» для полного списка команд!`,
        `Прости, не распознала запрос 💜 Я сейчас работаю без облака, но могу помочь с задачами!\n\nНапример: «Добавь задачу почитать книгу» или «Покажи мои задачи»`
    ];
    return novaStubs[Math.floor(Math.random() * novaStubs.length)];
}

export { GOOGLE_OPENAI_BASE };
