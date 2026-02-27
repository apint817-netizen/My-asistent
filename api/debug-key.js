export default async function handler(req, res) {
    const apiKey = process.env.GOOGLE_API_KEY;

    const keyInfo = {
        exists: !!apiKey,
        length: apiKey ? apiKey.length : 0,
        prefix: apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET',
        env_keys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('API') || k.includes('KEY')),
    };

    // Если есть ключ, проверяем его валидность через Google API
    if (apiKey) {
        try {
            const testResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            );
            const testData = await testResponse.json();

            if (testResponse.ok) {
                const models = (testData.models || [])
                    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));
                keyInfo.valid = true;
                keyInfo.availableModels = models;
            } else {
                keyInfo.valid = false;
                keyInfo.googleError = testData.error?.message || 'Unknown error';
            }
        } catch (e) {
            keyInfo.valid = false;
            keyInfo.networkError = e.message;
        }
    }

    return res.status(200).json(keyInfo);
}
