import OpenAI from "openai";

async function testUrl(url) {
    const aiClient = new OpenAI({ apiKey: "AIzaSy_fake", baseURL: url });
    try {
        await aiClient.chat.completions.create({ model: 'gemini-1.5-flash', messages: [{ role: 'user', content: 'test' }] });
    } catch (e) {
        console.log(`URL: ${url} -> ERROR: ${e.status} ${e.message}`);
    }
}

async function run() {
    await testUrl('https://generativelanguage.googleapis.com/v1beta/openai'); // Without slash
    await testUrl('https://generativelanguage.googleapis.com/v1beta/openai/'); // With slash
}
run();
