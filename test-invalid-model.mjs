import fetch from 'node-fetch';

async function testInvalidModel() {
    console.log("Testing invalid model gemini-2.5-flash");
    const key = process.env.GOOGLE_API_KEY || ''; // it's okay to use empty to see if it even reaches model check
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, { method: 'POST', body: '{"contents":[]}', headers: { 'Content-Type': 'application/json' } });
    console.log(`Status: ${res.status}`);
    console.log(`Text: ${await res.text()}`);
}
testInvalidModel();
