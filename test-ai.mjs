import fetch from 'node-fetch';

async function testGoogleApi() {
    const GOOGLE_API_KEY = "sk-xxxxxxxxxxxxxxxx"; // Мы не знаем ключ Vercel, но попробуем локальный proxy, если он есть в store
    // Либо отправим на локальный Vercel (npm run dev)

    // Но npm run dev не поднимает /api функции как Vercel. 
    // Vite Dev Server обслуживает /api через PROXY? 
    // Давайте проверим vite.config.js
}

testGoogleApi().catch(console.error);
