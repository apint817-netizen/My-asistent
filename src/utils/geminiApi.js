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

    if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
    }

    throw new Error('Пустой ответ от ИИ');
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

export { GOOGLE_OPENAI_BASE };
