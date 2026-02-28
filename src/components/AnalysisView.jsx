import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Send, Bot, User, Target, Save, Trash2, Calendar as CalendarIcon, ListTodo, RefreshCw, X, Search, Check, Copy, Edit2 } from 'lucide-react';
import { callAI, GOOGLE_OPENAI_BASE } from '../utils/geminiApi';
import ReactMarkdown from 'react-markdown';

// Парсер тегов для формирования черновика
const parseAnalysisCommands = (text, currentDraft, updateDraftPlan) => {
    const taskRegex = /\[TASK:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
    const futureRegex = /\[CALENDAR_TASK:\s*"([^"]+)"\s*\|\s*(\d+)\s*\|\s*([^\]]+)\]/g;
    const regularRegex = /\[HABIT:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
    const rewardRegex = /\[REWARD:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;

    let match;
    let newToday = [...currentDraft.today];
    let newFuture = [...currentDraft.future];
    let newRegular = [...currentDraft.regular];
    let newRewards = [...(currentDraft.rewards || [])];
    let addedAnything = false;

    while ((match = taskRegex.exec(text)) !== null) {
        newToday.push({ title: match[1], points: parseInt(match[2], 10) });
        addedAnything = true;
    }

    while ((match = futureRegex.exec(text)) !== null) {
        newFuture.push({ title: match[1], points: parseInt(match[2], 10), date: match[3].trim() });
        addedAnything = true;
    }

    while ((match = regularRegex.exec(text)) !== null) {
        newRegular.push({ title: match[1], points: parseInt(match[2], 10) });
        addedAnything = true;
    }

    while ((match = rewardRegex.exec(text)) !== null) {
        newRewards.push({ title: match[1], cost: parseInt(match[2], 10) });
        addedAnything = true;
    }

    if (addedAnything) {
        updateDraftPlan({ today: newToday, future: newFuture, regular: newRegular, rewards: newRewards });
    }

    let cleanText = text.replace(taskRegex, '').replace(futureRegex, '').replace(regularRegex, '').replace(rewardRegex, '').trim();

    return { cleanText, addedAnything };
};

export default function AnalysisView() {
    const messages = useStore(state => state.analysisMessages);
    const addMessage = useStore(state => state.addAnalysisMessage);
    const clearMessages = useStore(state => state.clearAnalysisMessages);

    const draftPlan = useStore(state => state.draftPlan);
    const updateDraftPlan = useStore(state => state.updateDraftPlan);
    const clearDraftPlan = useStore(state => state.clearDraftPlan);
    const commitDraftPlan = useStore(state => state.commitDraftPlan);

    const apiKey = useStore(state => state.apiKey);
    const googleModel = useStore(state => state.googleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const tasks = useStore(state => state.tasks);
    const tokens = useStore(state => state.tokens);
    const rewards = useStore(state => state.rewards);
    const calendarTasks = useStore(state => state.calendarTasks);

    const analysisDraft = useStore(state => state.analysisDraft);
    const setAnalysisDraft = useStore(state => state.setAnalysisDraft);

    const [input, setInput] = useState(analysisDraft || '');
    const [isTyping, setIsTyping] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [editingMessageIndex, setEditingMessageIndex] = useState(null);
    const [editInput, setEditInput] = useState('');
    const [copiedIndex, setCopiedIndex] = useState(null);

    const chatMsgs = useMemo(() => {
        let msgs = messages.filter(m => m.role !== 'system');
        if (searchQuery.trim()) {
            msgs = msgs.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return msgs;
    }, [messages, searchQuery]);

    useEffect(() => {
        setAnalysisDraft(input);
    }, [input, setAnalysisDraft]);

    // Initial greeting if empty
    useEffect(() => {
        if (messages.length === 0) {
            addMessage({
                role: 'assistant',
                content: 'Привет! Я Стратег Nova. Моя задача — помочь тебе распланировать день и неделю, чтобы ты не выгорал и двигался к своим целям. Расскажи, какие у тебя главные задачи на ближайшие дни? Есть ли \"хвосты\" или то, что постоянно откладываешь?'
            });
        }
    }, [messages, addMessage]);

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            scrollToBottom();
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [messages, isTyping]);

    const generateAIResponse = async (userMessage) => {

        try {
            const todayDate = new Date().toISOString().split('T')[0];

            // Нумерованные списки для поиска по номеру
            const pendingTasksList = tasks.filter(t => !t.completed);
            const completedTasks = tasks.filter(t => t.completed).map(t => t.title).join(', ') || 'Нет выполненных';
            const pendingTasks = pendingTasksList.map((t, i) => `${i + 1}. ${t.title} (ID: ${t.id}, ${t.value} очк.)`).join('\n') || 'Нет невыполненных';
            const availableRewards = rewards.map((r, i) => `${i + 1}. ${r.title} (ID: ${r.id}, ${r.cost} очк.)`).join('\n') || 'Нет наград';

            const upcomingDates = Object.keys(calendarTasks || {}).sort().slice(0, 7);
            const calendarStr = upcomingDates.length > 0
                ? upcomingDates.map(date => `- ${date}: ${(calendarTasks[date] || []).map(t => t.title).join(', ')}`).join('\n')
                : 'Пока ничего не запланировано';

            const systemInstruction = `Ты Стратег Nova — ИИ-коуч и планировщик. Отвечай по-русски.

ТВОЙ СТИЛЬ:
- Будь конкретным и деловым. Не лей воду.
- Задавай 1-2 точных вопроса за раз.
- Как только понял ситуацию, СРАЗУ предлагай конкретные задачи и награды через теги.

БЫСТРЫЙ СЦЕНАРИЙ:
1. Пользователь рассказывает о своих делах → задай 1-2 уточняющих вопроса
2. После ответа — сразу предложи 2-5 задач и 1-2 награды через теги
3. Если пользователь отклоняет → спроси "Почему?" и предложи альтернативу
4. Если пользователь принимает → похвали и спроси, есть ли ещё дела

Сегодня: ${todayDate}. Очки для задач: от 5 до 100. Стоимость наград: от 20 до 500.

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Баланс очков: ${tokens}
- Выполнено сегодня: ${completedTasks}
- Невыполненные задачи (ссылайся по номеру #N, названию или ID):
${pendingTasks}
- Награды (ссылайся по номеру, названию или ID):
${availableRewards}
- Календарь:
${calendarStr}

ТЕГИ ДЛЯ ЧЕРНОВИКА (добавляют в план справа):
1. Задача на сегодня: [TASK: "Название" | Очки]
2. Задача на дату: [CALENDAR_TASK: "Название" | Очки | YYYY-MM-DD]
3. Привычка: [HABIT: "Название" | Очки]
4. Награда: [REWARD: "Название" | Стоимость]

ТЕГИ ДЛЯ ПРЯМОГО УПРАВЛЕНИЯ (выполняются немедленно):
- Отметить выполненной: [COMPLETE_TASK: "id или #номер или название"]
- Изменить очки: [EDIT_TASK_POINTS: "id" | новые_очки]
- Удалить задачу: [DELETE_TASK: "id или #номер или название"]
- Купить награду: [BUY_REWARD: "id или #номер или название"]

Когда используешь теги черновика, скажи: "Я составил черновик плана, он появился справа. Посмотри и скажи, всё ли ок?".`;

            const baseUrl = aiProvider === 'google' ? GOOGLE_OPENAI_BASE : proxyParams.url;
            // Форсируем пустой ключ для google, чтобы использовался серверный ключ из Vercel
            const key = aiProvider === 'google' ? '' : proxyParams.key;
            const model = aiProvider === 'google' ? (googleModel || 'gemini-2.0-flash') : (proxyParams.model || 'gemini-2.0-flash');

            const history = messages.filter(m => m.role !== 'system');
            const responseText = await callAI({ baseUrl, apiKey: key, model, systemPrompt: systemInstruction, history, userMessage });

            // --- Обработка тегов прямого управления ---
            const completeRegex = /\[COMPLETE_TASK:\s*"([^"]+)"\]/g;
            const editRegex = /\[EDIT_TASK_POINTS:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
            const deleteTaskRegex = /\[DELETE_TASK:\s*"([^"]+)"\]/g;
            const buyRewardRegex = /\[BUY_REWARD:\s*"([^"]+)"\]/g;

            let processedText = responseText;
            let match;

            // Утилита: найти задачу по ID, номеру или названию
            const findTask = (ref) => {
                const currentTasks = useStore.getState().tasks;
                const pending = currentTasks.filter(t => !t.completed);
                let found = currentTasks.find(t => t.id === ref);
                if (found) return found;
                const numMatch = ref.match(/^#?(\d+)$/);
                if (numMatch) {
                    const idx = parseInt(numMatch[1], 10) - 1;
                    if (idx >= 0 && idx < pending.length) return pending[idx];
                }
                const lower = ref.toLowerCase();
                found = currentTasks.find(t => t.title.toLowerCase() === lower);
                if (found) return found;
                found = currentTasks.find(t => t.title.toLowerCase().includes(lower));
                return found || null;
            };

            const findReward = (ref) => {
                const currentRewards = useStore.getState().rewards;
                let found = currentRewards.find(r => r.id === ref);
                if (found) return found;
                const numMatch = ref.match(/^#?(\d+)$/);
                if (numMatch) {
                    const idx = parseInt(numMatch[1], 10) - 1;
                    if (idx >= 0 && idx < currentRewards.length) return currentRewards[idx];
                }
                const lower = ref.toLowerCase();
                found = currentRewards.find(r => r.title.toLowerCase().includes(lower));
                return found || null;
            };

            while ((match = completeRegex.exec(responseText)) !== null) {
                const task = findTask(match[1]);
                if (task && !task.completed) {
                    useStore.getState().toggleTask(task.id);
                    useStore.getState().addTokens(task.value);
                }
            }

            while ((match = editRegex.exec(responseText)) !== null) {
                const task = findTask(match[1]);
                if (task) useStore.getState().editTaskPoints(task.id, parseInt(match[2], 10));
            }

            while ((match = deleteTaskRegex.exec(responseText)) !== null) {
                const task = findTask(match[1]);
                if (task) useStore.getState().deleteTaskWithReason(task.id, 'Удалено через Стратег Nova');
            }

            while ((match = buyRewardRegex.exec(responseText)) !== null) {
                const reward = findReward(match[1]);
                if (reward) useStore.getState().buyRewardById(reward.id);
            }

            processedText = processedText
                .replace(completeRegex, '').replace(editRegex, '')
                .replace(deleteTaskRegex, '').replace(buyRewardRegex, '')
                .trim();

            // Parsing draft commands (TASK, CALENDAR_TASK, HABIT, REWARD)
            const { cleanText, addedAnything } = parseAnalysisCommands(processedText, draftPlan, updateDraftPlan);

            let finalMessage = cleanText;
            if (addedAnything) {
                finalMessage += `\n\n*(Система: Черновик плана обновлен. Проверьте панель справа)*`;
            }

            addMessage({ role: 'assistant', content: finalMessage });
        } catch (error) {
            console.error("AI Error:", error);
            if (error.message.includes('429') || error.message.includes('Quota exceeded')) {
                addMessage({
                    role: 'assistant',
                    content: `Упс! ⏳ Кажется, мы исчерпали лимит запросов нейросети на эту минуту.\n\nДавайте сделаем крошечную паузу, и через минуту я снова буду с вами!`
                });
            } else {
                addMessage({
                    role: 'assistant',
                    content: `Ошибка: ${error.message}. Попробуйте ещё раз через минуту.`
                });
            }
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input.trim();
        setInput('');
        addMessage({ role: 'user', content: userMsg });
        setIsTyping(true);

        await generateAIResponse(userMsg);
    };

    const handleEditSave = (index) => {
        if (!editInput.trim()) return;

        const msgToEdit = chatMsgs[index];
        const globalIndex = messages.findIndex(m => m === msgToEdit);

        if (globalIndex !== -1) {
            useStore.setState(state => {
                const updated = [...state.analysisMessages];
                updated[globalIndex].content = editInput.trim();
                return { analysisMessages: updated };
            });
        }
        setEditingMessageIndex(null);
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const formatDateSeparator = (dateString) => {
        if (!dateString) return 'Сегодня';
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Сегодня';
        if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const handleCommit = () => {
        commitDraftPlan();
        addMessage({ role: 'system', content: '[СИСТЕМНОЕ СООБЩЕНИЕ] План утвержден и перенесен на Главную и в Календарь.' });
    };

    const handleClearChat = () => {
        if (window.confirm('Сбросить весь диалог?')) {
            clearMessages();
            clearDraftPlan();
        }
    }

    const hasDraftItems = draftPlan.today.length > 0 || draftPlan.future.length > 0 || draftPlan.regular.length > 0 || (draftPlan.rewards || []).length > 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 h-full min-h-[500px]">
            {/* Левая колонка - Чат */}
            <div className="glass-panel p-0 flex flex-col h-full overflow-hidden border-accent/20 max-h-full">
                <div className="p-4 border-b border-border bg-black/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Target size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Стратег Nova</h3>
                            <p className="text-xs text-text-secondary">Анализ и планирование</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isSearching ? (
                            <div className="flex items-center bg-black/40 border border-border rounded-full px-3 py-1 animate-fade-in w-48">
                                <Search size={14} className="text-text-secondary mr-2 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Поиск..."
                                    className="bg-transparent border-none text-sm text-white outline-none w-full"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className="text-text-secondary hover:text-white shrink-0 ml-1">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsSearching(true)}
                                className="p-2 rounded-full transition-all text-text-secondary hover:text-accent hover:bg-accent/10"
                                title="Поиск по чату"
                            >
                                <Search size={16} />
                            </button>
                        )}
                        <button onClick={handleClearChat} className="p-2 text-text-secondary hover:text-danger bg-white/5 rounded-lg transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                >
                    {chatMsgs.length === 0 && searchQuery && (
                        <div className="text-center text-text-secondary mt-10">По запросу "{searchQuery}" ничего не найдено</div>
                    )}

                    {chatMsgs.map((msg, i) => {
                        const prevMsg = chatMsgs[i - 1];
                        const showDateSeparator = !searchQuery && (!prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString());

                        return (
                            <div key={i} className="flex flex-col">
                                {showDateSeparator && (
                                    <div className="flex justify-center my-4">
                                        <span className="bg-black/40 text-text-secondary text-xs px-3 py-1 rounded-full border border-border">
                                            {formatDateSeparator(msg.timestamp)}
                                        </span>
                                    </div>
                                )}

                                <div className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}>
                                    {(msg.role !== 'user' && msg.role !== 'system') ? (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-1">
                                            <Target size={14} className="text-white" />
                                        </div>
                                    ) : msg.role === 'user' ? (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-600`}>
                                            <User size={16} className="text-white" />
                                        </div>
                                    ) : null}

                                    <div className={`relative flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                        {editingMessageIndex === i && msg.role === 'user' ? (
                                            <div className="w-full min-w-[250px] bg-blue-600/20 border border-blue-500/50 p-3 rounded-2xl rounded-tr-none shadow-sm">
                                                <textarea
                                                    className="w-full bg-black/40 border border-blue-500/30 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-400 resize-none"
                                                    value={editInput}
                                                    onChange={(e) => setEditInput(e.target.value)}
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <button onClick={() => setEditingMessageIndex(null)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors">Отмена</button>
                                                    <button onClick={() => handleEditSave(i)} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs transition-colors">Сохранить</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={`p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                                                    ? 'bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-none whitespace-pre-wrap'
                                                    : msg.role === 'system'
                                                        ? 'bg-black/30 border border-border text-text-secondary text-sm italic w-full text-center'
                                                        : 'bg-bg-primary border border-border text-text-primary rounded-tl-none prose prose-invert max-w-none'
                                                    }`}>
                                                    {msg.role === 'user' || msg.role === 'system' ? (
                                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                    ) : (
                                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                    )}
                                                </div>

                                                {msg.role !== 'system' && (
                                                    <div className={`flex items-center gap-2 mt-1 text-[10px] text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                                                        <span>{formatTime(msg.timestamp)}</span>
                                                        <button
                                                            onClick={() => handleCopy(msg.content, i)}
                                                            className="hover:text-white transition-colors flex items-center gap-1"
                                                        >
                                                            {copiedIndex === i ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                                                        </button>
                                                        {msg.role === 'user' && (
                                                            <button
                                                                onClick={() => { setEditingMessageIndex(i); setEditInput(msg.content); }}
                                                                className="hover:text-blue-400 transition-colors"
                                                            >
                                                                <Edit2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {isTyping && (
                        <div className="flex gap-3 justify-start items-center text-text-secondary p-2">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick action buttons - show when user hasn't sent any messages yet */}
                {messages.filter(m => m.role === 'user').length === 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-2">
                        {[
                            { text: '📋 Распланировать день', msg: 'Помоги распланировать мой день' },
                            { text: '💥 Завал задач', msg: 'У меня накопилось много дел и я не знаю за что взяться' },
                            { text: '🌱 Новая привычка', msg: 'Хочу выработать новую полезную привычку' },
                            { text: '🎁 Придумать награды', msg: 'Помоги придумать мотивирующие награды за выполнение задач' },
                            { text: '✅ Проверить задачи', msg: 'Проверь мои текущие задачи — какие стоит изменить или добавить?' },
                        ].map((btn, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    addMessage({ role: 'user', content: btn.msg });
                                    setIsTyping(true);
                                    generateAIResponse(btn.msg);
                                }}
                                className="px-3 py-2 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent hover:bg-accent/20 hover:border-accent/40 transition-all"
                            >
                                {btn.text}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSend} className="p-4 border-t border-border bg-black/20">
                    <div className="relative flex items-end">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            placeholder="Опиши свои цели или проблемы..."
                            className="w-full bg-bg-primary border border-border rounded-xl pl-4 pr-12 py-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-sm resize-none custom-scrollbar"
                            disabled={isTyping}
                            rows={1}
                            style={{ maxHeight: '120px', minHeight: '44px', height: 'auto', overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; } }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping}
                            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all ${input.trim() && !isTyping ? 'bg-accent text-white hover:bg-accent-hover' : 'text-text-secondary'
                                }`}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </form>
            </div>

            {/* Правая колонка - Черновик */}
            <div className="glass-panel p-6 flex flex-col h-full overflow-hidden border-success/20 relative">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Save size={20} className="text-success" />
                        Черновик расписания
                    </h2>
                    {hasDraftItems && (
                        <button onClick={clearDraftPlan} className="text-xs text-text-secondary hover:text-danger flex items-center gap-1">
                            <Trash2 size={12} />
                            Очистить
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    {!hasDraftItems ? (
                        <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50 space-y-4">
                            <ListTodo size={48} />
                            <p className="text-center max-w-[200px]">Пусто. Стратег добавит сюди задачи после диалога с вами.</p>
                        </div>
                    ) : (
                        <>
                            {draftPlan.today.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-success uppercase tracking-wider flex items-center gap-2">
                                        На сегодня
                                        <span className="bg-success/20 text-success py-0.5 px-2 rounded-full text-xs">{draftPlan.today.length}</span>
                                    </h3>
                                    <div className="space-y-2">
                                        {draftPlan.today.map((task, i) => (
                                            <div key={i} className="bg-bg-primary/50 border border-border p-3 rounded-xl flex justify-between items-center group">
                                                <span className="text-sm">{task.title}</span>
                                                <span className="text-xs font-bold text-warning">+{task.points}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {draftPlan.regular.length > 0 && (
                                <div className="space-y-3 mt-6">
                                    <h3 className="text-sm font-bold text-accent uppercase tracking-wider flex items-center gap-2">
                                        <RefreshCw size={14} /> Regular / Привычки
                                    </h3>
                                    <div className="space-y-2">
                                        {draftPlan.regular.map((habit, i) => (
                                            <div key={i} className="bg-bg-primary/50 border border-border p-3 rounded-xl flex justify-between items-center group">
                                                <span className="text-sm">{habit.title}</span>
                                                <span className="text-xs font-bold text-warning">+{habit.points}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {draftPlan.future.length > 0 && (
                                <div className="space-y-3 mt-6">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                        <CalendarIcon size={14} /> В календарь
                                    </h3>
                                    <div className="space-y-2">
                                        {draftPlan.future.map((task, i) => (
                                            <div key={i} className="bg-bg-primary/50 border border-border p-3 rounded-xl flex flex-col gap-1 group">
                                                <div className="flex justify-between">
                                                    <span className="text-sm">{task.title}</span>
                                                    <span className="text-xs font-bold text-warning">+{task.points}</span>
                                                </div>
                                                <span className="text-xs text-text-secondary">{task.date}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(draftPlan.rewards || []).length > 0 && (
                                <div className="space-y-3 mt-6">
                                    <h3 className="text-sm font-bold text-warning uppercase tracking-wider flex items-center gap-2">
                                        🎁 Награды
                                        <span className="bg-warning/20 text-warning py-0.5 px-2 rounded-full text-xs">{draftPlan.rewards.length}</span>
                                    </h3>
                                    <div className="space-y-2">
                                        {draftPlan.rewards.map((reward, i) => (
                                            <div key={i} className="bg-bg-primary/50 border border-warning/20 p-3 rounded-xl flex justify-between items-center group">
                                                <span className="text-sm">{reward.title}</span>
                                                <span className="text-xs font-bold text-warning">{reward.cost} очк.</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {hasDraftItems && (
                    <div className="pt-4 mt-auto border-t border-border">
                        <button
                            onClick={handleCommit}
                            className="w-full py-3 bg-success hover:bg-success/90 text-white font-bold rounded-xl transition-colors shadow-lg shadow-success/20"
                        >
                            Утвердить и сохранить план
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
