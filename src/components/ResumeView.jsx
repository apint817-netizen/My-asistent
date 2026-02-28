import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Upload, FileText, Loader, CheckCircle, AlertCircle, Send, Briefcase, Brain, Zap, Heart, GraduationCap, Flame } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { callAI } from '../utils/geminiApi';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const STATUS_OPTIONS = [
    { id: 'job_search', label: 'Ищу работу', icon: Briefcase, color: 'text-blue-400' },
    { id: 'career_change', label: 'Меняю профессию', icon: Zap, color: 'text-yellow-400' },
    { id: 'growth', label: 'Расту в должности', icon: Flame, color: 'text-green-400' },
    { id: 'apathy', label: 'Апатия', icon: Heart, color: 'text-red-400' },
    { id: 'burnout', label: 'Выгорание', icon: Brain, color: 'text-orange-400' },
    { id: 'student', label: 'Студент', icon: GraduationCap, color: 'text-purple-400' },
];

// Same parser as AnalysisView
const parseResumeCommands = (text, addTask, addReward, addCalendarTask) => {
    if (!text || typeof text !== 'string') {
        return { cleanText: '', tasks: [], habits: [], calendarTasks: [], rewards: [] };
    }

    const taskRegex = /\[TASK:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
    const futureRegex = /\[CALENDAR_TASK:\s*"([^"]+)"\s*\|\s*(\d+)\s*\|\s*([^\]]+)\]/g;
    const habitRegex = /\[HABIT:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
    const rewardRegex = /\[REWARD:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;

    let match;
    const tasks = [];
    const habits = [];
    const calendarTasks = [];
    const rewards = [];

    while ((match = taskRegex.exec(text)) !== null) {
        const pts = parseInt(match[2], 10);
        tasks.push({ title: match[1], points: isNaN(pts) ? 10 : pts });
    }
    while ((match = futureRegex.exec(text)) !== null) {
        const pts = parseInt(match[2], 10);
        calendarTasks.push({ title: match[1], points: isNaN(pts) ? 10 : pts, date: match[3].trim() });
    }
    while ((match = habitRegex.exec(text)) !== null) {
        const pts = parseInt(match[2], 10);
        habits.push({ title: match[1], points: isNaN(pts) ? 10 : pts });
    }
    while ((match = rewardRegex.exec(text)) !== null) {
        const cst = parseInt(match[2], 10);
        rewards.push({ title: match[1], cost: isNaN(cst) ? 50 : cst });
    }

    let cleanText = text
        .replace(taskRegex, '')
        .replace(futureRegex, '')
        .replace(habitRegex, '')
        .replace(rewardRegex, '')
        .trim();

    return { cleanText, tasks, habits, calendarTasks, rewards };
};

export default function ResumeView() {
    const addTask = useStore(state => state.addTask);
    const addReward = useStore(state => state.addReward);
    const addCalendarTask = useStore(state => state.addCalendarTask);
    const googleModel = useStore(state => state.googleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const apiKey = useStore(state => state.apiKey);

    const [file, setFile] = useState(null);
    const [textInput, setTextInput] = useState('');
    const [status, setStatus] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const [parsedItems, setParsedItems] = useState(null);
    const [committed, setCommitted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileRef = useRef(null);

    const handleFileSelection = (f) => {
        if (f.name.toLowerCase().endsWith('.doc')) {
            setError('Формат .doc устарел и не поддерживается. Пожалуйста, сохраните файл как .docx или .pdf и загрузите снова.');
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (f.size > maxSize) {
            setError('Файл слишком большой (макс. 10 МБ)');
            return;
        }
        setFile(f);
        setError('');
    };

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) {
            handleFileSelection(f);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) {
            handleFileSelection(f);
        }
    };

    const handleAnalyze = async () => {
        if (!status) {
            setError('Выберите ваше текущее состояние');
            return;
        }
        if (!file && !textInput.trim()) {
            setError('Загрузите файл или введите текст резюме');
            return;
        }

        setIsAnalyzing(true);
        setError('');
        setAnalysis(null);
        setParsedItems(null);
        setCommitted(false);

        try {
            let parsedText = textInput.trim();

            if (file) {
                if (file.type === 'application/pdf') {
                    try {
                        // Локальный парсинг PDF через pdfjs-dist
                        const arrayBuffer = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        let text = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            text += textContent.items.map(s => s.str).join(' ') + '\n';
                        }
                        if (!text.trim()) {
                            throw new Error("Не удалось извлечь текст из PDF. Возможно, это скан без текстового слоя.");
                        }
                        parsedText = text;
                    } catch (pdfErr) {
                        console.error("Ошибка чтения PDF:", pdfErr);
                        throw new Error(`Не удалось прочитать PDF: ${pdfErr.message}`);
                    }
                } else {
                    // Отправляем на сервер другие форматы (DOCX, RTF)
                    const buffer = await file.arrayBuffer();
                    const base64 = btoa(
                        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );

                    const resp = await fetch('/api/resume', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileContent: base64, fileType: file.type || 'application/octet-stream' })
                    });

                    const data = await resp.json();
                    if (!resp.ok) {
                        throw new Error(data.error || 'Ошибка загрузки/парсинга файла');
                    }
                    parsedText = data.parsedText || parsedText;
                }
            }

            const statusMap = {
                'apathy': 'Апатия, нет мотивации',
                'job_search': 'Активный поиск работы',
                'career_change': 'Смена карьеры/профессии',
                'growth': 'Рост и развитие в текущей должности',
                'burnout': 'Выгорание, нужен перезапуск',
                'student': 'Студент/начинающий специалист'
            };
            const statusText = statusMap[status] || status;

            const systemPrompt = `Ты — карьерный ИИ-стратег. Проанализируй резюме пользователя и его текущее состояние.

ЗАДАНИЕ:
1. Кратко оцени сильные и слабые стороны (2-3 предложения)
2. Предложи 3-5 конкретных задач, которые помогут пользователю прямо сейчас исходя из его состояния
3. Используй теги для задач:
   - [TASK: "Название" | Очки] — задача на сегодня
   - [CALENDAR_TASK: "Название" | Очки | YYYY-MM-DD] — задача на ближайшие дни
   - [HABIT: "Название" | Очки] — полезная привычка
   - [REWARD: "Название" | Стоимость] — награда за мотивацию

Дата сегодня: ${new Date().toISOString().split('T')[0]}
Очки: 5, 10, 15, 30, 50. Стоимость наград: 20, 50, 100, 200.

Отвечай по-русски. Будь конкретным и полезным. Не лей воду.`;

            let textToSend = parsedText;
            const SAFE_LIMIT = 4500;
            if (textToSend.length > SAFE_LIMIT) {
                textToSend = textToSend.substring(0, SAFE_LIMIT) + '\n...[Текст обрезан для экономии ИИ-ресурсов. Основная суть сохранена]';
                console.warn(`Text truncated from ${parsedText.length} to ${SAFE_LIMIT} chars`);
            }

            const userMessage = `ТЕКУЩЕЕ СОСТОЯНИЕ: ${statusText}\n\nРЕЗЮМЕ:\n${textToSend}`;

            const key = aiProvider === 'google' ? '' : proxyParams.key;
            const model = aiProvider === 'google' ? (googleModel || 'gemini-2.0-flash') : (proxyParams.model || 'gemini-2.0-flash');
            const aiResponse = await callAI({
                baseUrl: aiProvider === 'google' ? 'https://generativelanguage.googleapis.com/v1beta/openai' : proxyParams.url,
                apiKey: key,
                model: model,
                systemPrompt,
                history: [],
                userMessage,
                maxTokens: 4096
            });

            const { cleanText, tasks, habits, calendarTasks, rewards } = parseResumeCommands(aiResponse);
            setAnalysis(cleanText);
            setParsedItems({ tasks, habits, calendarTasks, rewards });

        } catch (err) {
            console.error("Analysis Error:", err);
            if (err.message.includes('429') || err.message.includes('Quota exceeded')) {
                setError('Упс! ⏳ Кажется, мы исчерпали лимит запросов нейросети на эту минуту.\n\nДавайте сделаем крошечную паузу, и через минуту всё снова заработает! (Также вы можете сменить ключ или модель в настройках)');
            } else {
                setError(`Ошибка анализа: ${err.message}. Проверьте правильность настроек API.`);
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCommit = () => {
        if (!parsedItems) return;

        parsedItems.tasks.forEach(t => addTask(t.title, t.points));
        parsedItems.habits.forEach(h => addTask(h.title + ' 🔄', h.points));
        parsedItems.rewards.forEach(r => addReward({ title: r.title, cost: r.cost }));

        // Calendar tasks
        parsedItems.calendarTasks.forEach(ct => {
            if (addCalendarTask) {
                addCalendarTask(ct.date, ct.title, ct.points);
            }
        });

        setCommitted(true);
    };

    const totalItems = parsedItems
        ? parsedItems.tasks.length + parsedItems.habits.length + parsedItems.calendarTasks.length + parsedItems.rewards.length
        : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
            {/* Left - Upload & Settings */}
            <div className="glass-panel p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <FileText size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Анализ резюме</h3>
                        <p className="text-xs text-text-secondary">Загрузите резюме и получите план действий</p>
                    </div>
                </div>

                <div className="mb-5">
                    <label className="text-sm text-text-secondary font-medium block mb-2">📎 Загрузите резюме</label>
                    <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging ? 'border-accent bg-accent/20 scale-[1.02]' : file ? 'border-success/50 bg-success/5' : 'border-border hover:border-accent/50 hover:bg-white/5'}`}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.txt,.rtf"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {file ? (
                            <div className="flex items-center justify-center gap-2 text-success">
                                <CheckCircle size={20} />
                                <span className="text-sm font-medium">{file.name}</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload size={28} className="mx-auto text-text-secondary" />
                                <p className="text-sm text-text-secondary">PDF, DOCX, TXT</p>
                                <p className="text-xs text-text-secondary/60">или перетащите файл сюда</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Or text input */}
                <div className="mb-5">
                    <label className="text-sm text-text-secondary font-medium block mb-2">✏️ Или вставьте текст</label>
                    <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Вставьте содержимое вашего резюме..."
                        className="w-full bg-black/40 border border-border rounded-xl p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none custom-scrollbar"
                        rows={4}
                    />
                </div>

                {/* Status Selection */}
                <div className="mb-6">
                    <label className="text-sm text-text-secondary font-medium block mb-2">🎯 Ваше текущее состояние</label>
                    <div className="grid grid-cols-2 gap-2">
                        {STATUS_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => { setStatus(opt.id); setError(''); }}
                                className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all border ${status === opt.id
                                    ? 'bg-accent/20 border-accent/50 text-accent'
                                    : 'bg-black/20 border-border text-text-secondary hover:bg-white/5 hover:border-border'
                                    }`}
                            >
                                <opt.icon size={16} className={status === opt.id ? 'text-accent' : opt.color} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 text-danger text-sm bg-danger/10 border border-danger/20 p-3 rounded-xl animate-fade-in">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader size={18} className="animate-spin" />
                            Анализирую...
                        </>
                    ) : (
                        <>
                            <Send size={18} />
                            Проанализировать
                        </>
                    )}
                </button>
            </div>

            {/* Right - Analysis Results */}
            <div className="glass-panel p-6 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Brain size={20} className="text-emerald-400" />
                        Результат анализа
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {!analysis && !isAnalyzing && (
                        <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50 space-y-4">
                            <FileText size={48} />
                            <p className="text-center max-w-[250px]">Загрузите резюме и нажмите «Проанализировать» чтобы получить персональный план</p>
                        </div>
                    )}

                    {isAnalyzing && (
                        <div className="h-full flex flex-col items-center justify-center text-text-secondary space-y-4 animate-fade-in">
                            <Loader size={48} className="animate-spin text-emerald-400" />
                            <p className="text-center">ИИ анализирует ваше резюме...</p>
                        </div>
                    )}

                    {analysis && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="prose prose-invert max-w-none text-sm">
                                <ReactMarkdown>{analysis}</ReactMarkdown>
                            </div>

                            {totalItems > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                                        Предложенные действия ({totalItems})
                                    </h3>

                                    {parsedItems.tasks.map((t, i) => (
                                        <div key={'t' + i} className="bg-success/10 border border-success/20 p-3 rounded-xl flex justify-between items-center">
                                            <span className="text-sm">📌 {t.title}</span>
                                            <span className="text-xs font-bold text-warning">+{t.points}</span>
                                        </div>
                                    ))}
                                    {parsedItems.habits.map((h, i) => (
                                        <div key={'h' + i} className="bg-accent/10 border border-accent/20 p-3 rounded-xl flex justify-between items-center">
                                            <span className="text-sm">🔄 {h.title}</span>
                                            <span className="text-xs font-bold text-warning">+{h.points}</span>
                                        </div>
                                    ))}
                                    {parsedItems.calendarTasks.map((ct, i) => (
                                        <div key={'c' + i} className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex flex-col gap-1">
                                            <div className="flex justify-between">
                                                <span className="text-sm">📅 {ct.title}</span>
                                                <span className="text-xs font-bold text-warning">+{ct.points}</span>
                                            </div>
                                            <span className="text-xs text-text-secondary">{ct.date}</span>
                                        </div>
                                    ))}
                                    {parsedItems.rewards.map((r, i) => (
                                        <div key={'r' + i} className="bg-warning/10 border border-warning/20 p-3 rounded-xl flex justify-between items-center">
                                            <span className="text-sm">🎁 {r.title}</span>
                                            <span className="text-xs font-bold text-warning">{r.cost} очк.</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {totalItems > 0 && !committed && (
                    <div className="pt-4 mt-auto border-t border-border">
                        <button
                            onClick={handleCommit}
                            className="w-full py-3 bg-success hover:bg-success/90 text-white font-bold rounded-xl transition-colors shadow-lg shadow-success/20"
                        >
                            ✅ Принять план ({totalItems} действий)
                        </button>
                    </div>
                )}

                {committed && (
                    <div className="pt-4 mt-auto border-t border-border">
                        <div className="w-full py-3 bg-success/20 text-success font-bold rounded-xl text-center flex items-center justify-center gap-2">
                            <CheckCircle size={18} />
                            План принят и добавлен на главную!
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
