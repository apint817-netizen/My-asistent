export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { model, messages, temperature = 0.9, max_tokens = 2048 } = req.body;

    const authHeader = req.headers.authorization || '';
    let clientKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    if (clientKey === 'undefined' || clientKey === 'null' || clientKey === '' || clientKey === 'AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc') {
        clientKey = null;
    }

    const apiKey = clientKey || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'API Key не настроен' });
    }

    // Быстрая модель — gemini-2.0-flash (не thinking, укладывается в таймаут Vercel)
    let targetModel = model || 'gemini-2.0-flash';

    try {
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

        const body = {
            contents,
            generationConfig: { temperature, maxOutputTokens: max_tokens }
        };

        if (systemInstruction) {
            body.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        // Вызов Google API — без лишних fallback, сразу работающая модель
        const callGemini = async (modelName) => {
            const clean = modelName.replace('models/', '');
            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${apiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            );
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`${resp.status} on ${clean}: ${text.substring(0, 200)}`);
            }
            return { data: await resp.json(), model: clean };
        };

        // Быстрый fallback: 2.0-flash → 2.0-flash-lite (обе быстрые, без thinking)
        const modelsToTry = [...new Set([
            targetModel.replace('models/', ''),
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite'
        ])];

        let result = null;
        let lastError = null;

        for (const m of modelsToTry) {
            try {
                result = await callGemini(m);
                break;
            } catch (e) {
                lastError = e;
                if (e.message.includes('400')) break; // bad key
                continue;
            }
        }

        if (!result) {
            throw lastError || new Error('All models failed');
        }

        const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({
            choices: [{ message: { role: 'assistant', content: text } }],
            usage: { total_tokens: result.data.usageMetadata?.totalTokenCount || 0 },
            model_used: result.model
        });

    } catch (error) {
        console.error('AI Error:', error.message);
        return res.status(500).json({ error: error.message || 'Internal error' });
    }
}
