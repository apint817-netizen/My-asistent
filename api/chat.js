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
        const bodyText = await req.text();
        const requestData = JSON.parse(bodyText);
        const { model, messages, temperature = 0.9, max_tokens = 2048 } = requestData;

        const authHeader = req.headers.get('authorization') || '';
        let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '' || clientKey === 'AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc') {
            clientKey = null;
        }

        // Ключ пользователя предоставлен для настройки
        const FALLBACK_KEY = 'AIzaSyAfgQ49IlHjrtjkgLVJzUE3dKIPt-eybiY';
        // На Edge process.env.GOOGLE_API_KEY работает только если задан в Vercel
        // В Edge Runtime иногда process.env не существует напрямую, используется глобальный process
        const envKey = typeof process !== 'undefined' && process.env ? process.env.GOOGLE_API_KEY : null;
        const apiKey = clientKey || envKey || FALLBACK_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API Key не настроен' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let targetModel = model || 'gemini-2.0-flash';

        const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => {
                const role = m.role === 'assistant' ? 'model' : 'user';
                if (Array.isArray(m.content)) {
                    const parts = m.content.map(part => {
                        if (part.type === 'text') return { text: part.text };
                        if (part.type === 'image_url' && part.image_url?.url) {
                            const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                            if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
                            return { text: '[image]' };
                        }
                        return { text: JSON.stringify(part) };
                    });
                    return { role, parts };
                }
                return { role, parts: [{ text: m.content }] };
            });

        const geminiBody = {
            contents,
            generationConfig: { temperature, maxOutputTokens: max_tokens }
        };

        if (systemInstruction) {
            geminiBody.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        const callGemini = async (modelName) => {
            const clean = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName;
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${apiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
            );
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`${resp.status} on ${clean}: ${text.substring(0, 200)}`);
            }
            return { data: await resp.json(), model: clean };
        };

        // Запрашиваемая модель первой, затем самые надежные варианты для этого ключа
        let modelsToTry = [
            targetModel.startsWith('models/') ? targetModel.replace('models/', '') : targetModel,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite'
        ];

        // Убираем дубликаты
        modelsToTry = [...new Set(modelsToTry)];

        let result = null;
        let lastError = null;

        for (const m of modelsToTry) {
            try {
                result = await callGemini(m);
                break;
            } catch (e) {
                lastError = e;
                if (e.message.includes('400')) break; // Ошибка ключа или параметров, нет смысла пробовать другие
                console.warn(`Fallback: Model ${m} failed:`, e.message);
                continue;
            }
        }

        // Крайний случай - пробуем найти доступную модель программно
        if (!result) {
            try {
                const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                if (listRes.ok) {
                    const listData = await listRes.json();
                    const available = (listData.models || [])
                        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                        .map(m => m.name.replace('models/', ''));

                    const bestModel = available.find(m => m.includes('flash')) || available[0];
                    if (bestModel) {
                        result = await callGemini(bestModel);
                    }
                }
            } catch (e) {
                console.warn('Dynamic lookup failed');
            }
        }

        if (!result) {
            throw lastError || new Error('All models failed');
        }

        const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return new Response(JSON.stringify({
            choices: [{ message: { role: 'assistant', content: text } }],
            usage: { total_tokens: result.data.usageMetadata?.totalTokenCount || 0 },
            model_used: result.model
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('AI Error:', error.message);
        return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
