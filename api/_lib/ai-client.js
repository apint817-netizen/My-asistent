import OpenAI from 'openai';

/**
 * Создает инстанс OpenAI клиента с нужным ключом и базовым URL.
 * Это позволяет динамически переключаться между Vercel ключом и 
 * пользовательским ключом, который приходит с браузера.
 */
export function getAIClient(clientApiKey = null) {
    // 1. Приоритет отдаем ключу пользователя с фронтенда, если он есть
    // 2. Иначе используем серверный ключ Vercel GOOGLE_API_KEY
    const apiKey = clientApiKey || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error("No API key provided. Google API Key is missing on server and client.");
    }

    // Google предоставляет OpenAI-совместимый endpoint для своих моделей
    const baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai';

    return new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
    });
}
