/**
 * Единый хелпер для вызова ИИ.
 * В продакшене (Vercel) вся магия (fallback моделей, ключи) происходит на бекенде в /api/chat.
 * При локальной разработке (`npm run dev`) делаем прямой запрос в Google, 
 * так как локального Vercel сервера под `/api` нет.
 */

const GOOGLE_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

export async function callAI({ baseUrl, apiKey, model, systemPrompt, history, userMessage, maxTokens, attachments }) {
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

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let res;

    if (baseUrl === GOOGLE_OPENAI_BASE && isDevelopment) {
        // Локальная разработка: бьем напрямую в Google OpenAI-compatible endpoint
        res = await fetch(`${GOOGLE_OPENAI_BASE}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
    } else if (baseUrl === GOOGLE_OPENAI_BASE && !isDevelopment) {
        // Продакшен: бьем в наш надежный сервер Vercel (/api/chat.js с Fallbacks)
        res = await fetch('/api/chat', {
            method: 'POST',
            headers,
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

    if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
    }

    throw new Error('Пустой ответ от ИИ');
}

export const GOOGLE_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Быстрая, бесплатная' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Сложные задачи' }
];

export const PROXY_MODELS = [
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Через прокси' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Через прокси' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI' }
];

export { GOOGLE_OPENAI_BASE };
