import OpenAI from "openai";

const aiClient = new OpenAI({
    apiKey: process.env.GOOGLE_API_KEY || "AIzaSy_fake",
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});

async function run() {
    try {
        const response = await aiClient.chat.completions.create({
            model: 'gemini-1.5-flash',
            messages: [{ role: 'user', content: 'hello' }],
        });
        console.log("SUCCESS:", response.choices[0].message.content);
    } catch (e) {
        console.error("ERROR:", e.status, e.message);
    }
}
run();
