import handler from './api/chat.js';

const req = {
    method: 'POST',
    headers: {
        authorization: 'Bearer ' // let it fallback to process.env.GOOGLE_API_KEY
    },
    body: {
        model: 'gemini-2.0-flash',
        messages: [
            { role: 'system', content: 'You are a test.' },
            { role: 'user', content: 'Say hello!' }
        ]
    }
};

const res = {
    status: (code) => {
        console.log(`Status: ${code}`);
        return {
            json: (data) => console.log(`Response JSON:`, JSON.stringify(data, null, 2))
        };
    }
};

async function run() {
    process.env.GOOGLE_API_KEY = "dummy-key"; // we just want to see if it parses correctly and calls fetch
    try {
        await handler(req, res);
    } catch (e) {
        console.error(e);
    }
}
run();
