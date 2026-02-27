import OpenAI from "openai";

async function testUrl(url) {
    const aiClient = new OpenAI({ apiKey: "AIzaSyB9JNryZQwrYw8aNhplNaVz2kB-TnT88Nc", baseURL: url });
    try {
        const response = await aiClient.chat.completions.create({ model: 'gemini-1.5-flash', messages: [{ role: 'user', content: 'Say hello' }] });
        console.log(`URL: ${url} -> SUCCESS! -> ${response.choices[0].message.content}`);
    } catch (e) {
        console.log(`URL: ${url} -> ERROR: HTTP ${e.status} -> ${e.message}`);
    }
}

async function run() {
    await testUrl('https://generativelanguage.googleapis.com/v1beta/openai');
    await testUrl('https://generativelanguage.googleapis.com/v1beta/openai/');
}
run();
