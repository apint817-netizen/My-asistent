import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Send, Bot, User, MessageSquare, Eraser, Settings, Zap, Link as LinkIcon, HelpCircle, ChevronDown, Check, Copy, Edit2, X, Search } from 'lucide-react';
import { callAI, GOOGLE_OPENAI_BASE } from '../utils/geminiApi';
import ReactMarkdown from 'react-markdown';

export default function AIAssistant() {
    const messages = useStore(state => state.chatMessages);
    const addMessage = useStore(state => state.addChatMessage);
    const clearMessages = useStore(state => state.clearChatMessages);
    const tasks = useStore(state => state.tasks);
    const tokens = useStore(state => state.tokens);
    const rewards = useStore(state => state.rewards);
    const purchaseHistory = useStore(state => state.purchaseHistory);

    const apiKey = useStore(state => state.apiKey);
    const googleModel = useStore(state => state.googleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const calendarTasks = useStore(state => state.calendarTasks);

    // Подключаем черновик из стейта
    const chatDraft = useStore(state => state.chatDraft);
    const setChatDraft = useStore(state => state.setChatDraft);

    const [input, setInput] = useState(chatDraft || '');
    const [isTyping, setIsTyping] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [editingMessageIndex, setEditingMessageIndex] = useState(null);
    const [editInput, setEditInput] = useState('');
    const [copiedIndex, setCopiedIndex] = useState(null);

    useEffect(() => {
        setChatDraft(input);
    }, [input, setChatDraft]);

    const chatMsgs = useMemo(() => {
        let msgs = messages.filter(m => m.role !== 'system');
        if (searchQuery.trim()) {
            msgs = msgs.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return msgs;
    }, [messages, searchQuery]);

    const sysMsgs = messages.filter(m => m.role === 'system');

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
        if (aiProvider === 'google' && !apiKey) {
            setTimeout(() => {
                addMessage({
                    role: 'assistant',
                    content: 'Пожалуйста, добавь свой Gemini API Key в настройках (иконка шестеренки), чтобы я мог тебе помогать!'
                });
                setIsTyping(false);
            }, 500);
            return;
        }

        if (aiProvider === 'proxy' && !proxyParams.url) {
            setTimeout(() => {
                addMessage({
                    role: 'assistant',
                    content: 'Укажите URL локального прокси в настройках, чтобы я мог ответить!'
                });
                setIsTyping(false);
            }, 500);
            return;
        }

        try {
            const completedTasks = tasks.filter(t => t.completed).map(t => t.title).join(', ') || 'Нет выполненных';
            const pendingTasks = tasks.filter(t => !t.completed).map(t => `- ${t.title} (ID: ${t.id}, Очки: ${t.value})`).join('\n') || 'Нет невыполненных';
            const availableRewards = rewards.map(r => `${r.title} (${r.cost} очк.)`).join(', ');

            const recentPurchases = purchaseHistory.slice(0, 5).map(p =>
                `"${p.title}" (статус: ${p.status === 'refunded' ? `Отменено [Причина: ${p.refundReason}]` : p.status})`
            ).join('; ') || 'Нет покупок';

            const todayDate = new Date().toISOString().split('T')[0];
            const upcomingDates = Object.keys(calendarTasks || {}).sort().slice(0, 5);
            const calendarStr = upcomingDates.length > 0
                ? upcomingDates.map(date => `- ${date}: ${calendarTasks[date].reduce((sum, t) => sum + t.value, 0)} очков нагрузки`).join('\n')
                : 'Пока ничего не запланировано';

            const systemInstruction = `Ты Nova — персональный ИИ-наставник и мотиватор. Ты не просто чат-бот, а настоящий партнёр пользователя по саморазвитию. Отвечай по-русски.

ТВОЙ ХАРАКТЕР:
- Ты тёплая, внимательная, но при этом честная и прямая
- Ты задаёшь уточняющие вопросы, чтобы понять человека глубже
- Ты замечаешь эмоции и реагируешь на них
- Ты хвалишь за прогресс (даже маленький) и мягко подталкиваешь при застое
- Ты можешь быть строгой, если видишь саботаж

ПРАВИЛА ДИАЛОГА:
1. Не давай длинные монологи. Отвечай ёмко (2-4 предложения), задавай 1 вопрос в конце
2. Если пользователь делится проблемой — сначала прояви эмпатию, потом предлагай решение
3. При вопросе о составлении плана — перенаправляй пользователя в раздел Анализ.

УПРАВЛЕНИЕ ЗАДАЧАМИ (АКТИВИРУЙ ТЕГИ, ЕСЛИ ПРОСЯТ):
- Если пользователь просит/говорит, что выполнил задачу, добавь в свой ответ тег: [COMPLETE_TASK: "id_задачи"]
- Если пользователь просит изменить количество очков за задачу, добавь тег: [EDIT_TASK_POINTS: "id_задачи" | новое_количество_очков]
*Пользователь не увидит эти теги в чате, они выполнятся системой скрытно.*

Сегодняшняя дата: ${todayDate}

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Баланс очков: ${tokens}
- Выполнено сегодня: ${completedTasks}
- Не выполнено (копируй ID отсюда для тегов):
${pendingTasks}
- Календарь:
${calendarStr}
- Доступные награды: ${availableRewards}`;

            const baseUrl = aiProvider === 'google' ? GOOGLE_OPENAI_BASE : proxyParams.url;
            const key = aiProvider === 'google' ? apiKey : proxyParams.key;
            const model = aiProvider === 'google' ? (googleModel || 'gemini-2.0-flash') : (proxyParams.model || 'gemini-3-flash');

            const history = messages.filter(m => m.role !== 'system');
            const responseText = await callAI({ baseUrl, apiKey: key, model, systemPrompt: systemInstruction, history, userMessage });

            const completeRegex = /\[COMPLETE_TASK:\s*"([^"]+)"\]/g;
            const editRegex = /\[EDIT_TASK_POINTS:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;

            let cleanResponse = responseText;
            let match;

            while ((match = completeRegex.exec(responseText)) !== null) {
                const taskId = match[1];
                const task = useStore.getState().tasks.find(t => t.id === taskId);
                if (task) {
                    useStore.getState().toggleTask(taskId);
                    if (!task.completed) useStore.getState().addTokens(task.value);
                }
            }

            while ((match = editRegex.exec(responseText)) !== null) {
                const taskId = match[1];
                const points = parseInt(match[2], 10);
                useStore.getState().editTaskPoints(taskId, points);
            }

            cleanResponse = cleanResponse.replace(completeRegex, '').replace(editRegex, '').trim();

            addMessage({ role: 'assistant', content: cleanResponse });
        } catch (error) {
            console.error("AI Error:", error);
            addMessage({
                role: 'assistant',
                content: `Ошибка при обращении к ИИ: ${error.message}. Проверьте правильность настроек API.`
            });
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

        // Find the actual index in the global messages array
        const msgToEdit = chatMsgs[index];
        const globalIndex = messages.findIndex(m => m === msgToEdit);

        if (globalIndex !== -1) {
            const newMessages = [...messages];
            newMessages[globalIndex].content = editInput.trim();
            // Assuming we have a setChatMessages function, if not, we'd need to add it to useStore
            // For now, let's just update via store if we had the method. Since we don't, we'll
            // mutate state directly in a hacky way or just use a new action.
            // Let's assume useStore doesn't have an update message method yet. 
            // We will need to create one, or just skip full edit persistence for this specific example if not available.
            // Actually, let's add updateChatMessage to useStore in a separate step or just do what's possible.
            // *Wait, I only have addMessage. I'll need to dispatch an update function or just modify the array.*
            useStore.setState(state => {
                const updated = [...state.chatMessages];
                updated[globalIndex].content = editInput.trim();
                return { chatMessages: updated };
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

    return (
        <div className="flex flex-col h-full bg-black/20 rounded-inherit overflow-hidden relative" style={{ maxHeight: '100%' }}>
            {/* Header */}
            <div className="p-4 border-b border-border bg-black/10 flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center border border-accent/50 shadow-[0_0_15px_rgba(109,40,217,0.4)]">
                        <MessageSquare size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white tracking-wide">Ассистент Nova</h3>
                        <p className="text-xs text-success flex items-center gap-1.5 font-medium mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span> В сети
                        </p>
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
                            <Search size={18} />
                        </button>
                    )}
                    <button
                        onClick={clearMessages}
                        className="p-2 rounded-full transition-all text-text-secondary hover:text-danger hover:bg-danger/10 hover:rotate-12 hover:scale-110"
                        title="Очистить чат"
                    >
                        <Eraser size={18} />
                    </button>
                </div>
            </div>

            {/* System Logs Panel */}
            {sysMsgs.length > 0 && (
                <div className="bg-bg-secondary w-full border-b border-border z-10 text-xs shadow-md">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="w-full py-1.5 flex items-center justify-center gap-2 text-text-secondary hover:text-white transition-colors bg-black/20 font-medium"
                    >
                        {showLogs ? 'Скрыть системные логи' : `Системные логи (${sysMsgs.length})`}
                    </button>
                    {showLogs && (
                        <div className="max-h-32 overflow-y-auto p-3 space-y-2 bg-black/40 custom-scrollbar border-t border-border/50 shadow-inner">
                            {sysMsgs.map((msg, idx) => (
                                <div key={'sys' + idx} className="text-text-secondary font-mono border-l-2 border-border pl-2 py-0.5 leading-relaxed">
                                    {msg.content}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Window */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar relative">
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
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-accent'}`}>
                                    {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                                </div>

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
                                                : 'bg-accent/10 border border-accent/20 text-text-primary rounded-tl-none markdown-content'
                                                }`}>
                                                {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                            </div>

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
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {isTyping && (
                    <div className="flex gap-3 items-center animate-fade-in">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(109,40,217,0.3)]">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div className="flex gap-1.5 bg-accent/10 border border-accent/20 p-3 rounded-2xl rounded-tl-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0s' }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-1 w-full" />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-white/5 backdrop-blur-md z-10">
                <form onSubmit={handleSend} className="relative flex items-end">
                    <textarea
                        placeholder="Написать Nova..."
                        className="w-full bg-black/40 border border-border rounded-2xl pl-5 pr-12 py-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-secondary shadow-inner resize-none custom-scrollbar"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                        rows={1}
                        style={{ maxHeight: '120px', minHeight: '44px', height: 'auto', overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
                        ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; } }}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 bottom-2 p-2 rounded-full bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex justify-center items-center h-8 w-8"
                    >
                        <Send size={15} className="-ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
