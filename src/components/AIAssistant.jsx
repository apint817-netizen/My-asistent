import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Send, Bot, User, MessageSquare, Eraser, Settings, Zap, Link as LinkIcon, HelpCircle, ChevronDown, Check, Copy, Edit2, X, Search, Paperclip, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { callAI, GOOGLE_OPENAI_BASE } from '../utils/geminiApi';
import ReactMarkdown from 'react-markdown';
import ConfirmModal from './ConfirmModal';

export default function AIAssistant() {
    const messages = useStore(state => state.chatMessages);
    const addMessage = useStore(state => state.addChatMessage);
    const clearMessages = useStore(state => state.clearChatMessages);
    const tokens = useStore(state => state.tokens);
    const tasks = useStore(state => state.tasks);
    const rewards = useStore(state => state.rewards);
    const purchaseHistory = useStore(state => state.purchaseHistory);
    const addCalendarTask = useStore(state => state.addCalendarTask);
    const addToast = useStore(state => state.addToast);

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
    const [showConfirmLogs, setShowConfirmLogs] = useState(false);
    const [showConfirmChat, setShowConfirmChat] = useState(false);

    // Состояния для прикрепленных файлов
    const [attachments, setAttachments] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setChatDraft(input);
    }, [input, setChatDraft]);

    const chatMsgs = useMemo(() => {
        let msgs = messages.filter(m => m.role !== 'system');
        if (searchQuery.trim()) {
            msgs = msgs.filter(m => {
                const textContent = Array.isArray(m.content)
                    ? m.content.map(p => p.text || '').join(' ')
                    : (m.content || '');
                return textContent.toLowerCase().includes(searchQuery.toLowerCase());
            });
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
        // Для Google: ключ может быть на сервере Vercel (GOOGLE_API_KEY), поэтому НЕ блокируем
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
            // Нумерованный список задач (ИИ может ссылаться по номеру)
            const pendingTasksList = tasks.filter(t => !t.completed);
            const completedTasksList = tasks.filter(t => t.completed);
            const pendingTasks = pendingTasksList.map((t, i) => `${i + 1}. ${t.title} (ID: ${t.id}, ${t.value} очк.)`).join('\n') || 'Нет невыполненных';
            const completedTasks = completedTasksList.map(t => t.title).join(', ') || 'Нет выполненных';
            const availableRewards = rewards.map((r, i) => `${i + 1}. ${r.title} (ID: ${r.id}, ${r.cost} очк.)`).join('\n') || 'Нет наград';

            const recentPurchases = purchaseHistory.slice(0, 5).map(p =>
                `"${p.title}" (ID: ${p.purchaseId}, статус: ${p.status === 'refunded' ? `Отменено [Причина: ${p.refundReason}]` : p.status === 'used' ? 'Использовано' : 'Активно — можно использовать'})`
            ).join('; ') || 'Нет покупок';

            const today = new Date();
            const todayDate = today.toISOString().split('T')[0];
            const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
            const todayDayOfWeek = daysOfWeek[today.getDay()];

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

ПОЛНОЕ УПРАВЛЕНИЕ (ТЕГИ — ТОЛЬКО ПО ЗАПРОСУ ПОЛЬЗОВАТЕЛЯ):
Задачи:
- Отметить выполненной: [COMPLETE_TASK: "id или #номер или название"]
- Изменить очки: [EDIT_TASK_POINTS: "id" | новые_очки]
- Добавить задачу (В ОСНОВНОЙ СПИСОК): [ADD_TASK: "Название" | Очки]
- Добавить задачу на дату (В КАЛЕНДАРЬ): [ADD_CALENDAR_TASK: "Название" | Очки | "YYYY-MM-DD"]
- Добавить регулярную рутину (В КАЛЕНДАРЬ на месяц): [ADD_REGULAR_TASK: "Название" | Очки | "ПЕРИОД"]
  (где ПЕРИОД: "EVERY_DAY" (каждый день), "WORK_DAYS" (будни), "WEEKENDS" (выходные) или "1,3,5" для Пн,Ср,Пт)
- Удалить задачу: [DELETE_TASK: "id"]

Награды и покупки:
- Добавить награду: [ADD_REWARD: "Название" | Стоимость]
- Удалить награду: [DELETE_REWARD: "id"]
- Купить награду (списать очки): [BUY_REWARD: "id"]
- Использовать покупку: [USE_PURCHASE: "id_покупки"]

ВАЖНО: Ты можешь находить задачу по номеру в списке (#2), по названию или по ID. Используй ЛЮБОЙ метод, который понятнее по контексту. 
*КРИТИЧЕСКИ ВАЖНО ПРО УДАЛЕНИЕ: Если пользователь просит удалить задачу (или цель/привычку), и ты соглашаешься её удалить, ты ОБЯЗАН в конце своего текстового ответа прикрепить точный тег [DELETE_TASK: "ID задачи"]. Если ты ответишь просто согласием без тега, задача НЕ УДАЛИТСЯ, и система сломается!*
*Раскидывание на дни: Если просят на завтра/послезавтра/дату — используй [ADD_CALENDAR_TASK] с вычисленным YYYY-MM-DD. На несколько дней — несколько тегов.*

Сегодня: ${todayDate} (${todayDayOfWeek})

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Баланс очков: ${tokens}
- Выполнено сегодня: ${completedTasks}
- Невыполненные задачи (ссылайся по номеру #N, названию или ID):
${pendingTasks}
- Календарь:
${calendarStr}
- Награды (ссылайся по номеру, названию или ID):
${availableRewards}
- Последние покупки: ${recentPurchases}`;

            const baseUrl = aiProvider === 'google' ? GOOGLE_OPENAI_BASE : proxyParams.url;
            // Форсируем пустой ключ для google, чтобы использовался серверный ключ (Vercel)
            const key = aiProvider === 'google' ? '' : proxyParams.key;
            const model = aiProvider === 'google' ? (googleModel || 'gemini-2.0-flash') : (proxyParams.model || 'gemini-2.0-flash');

            const history = messages.filter(m => m.role !== 'system');

            // Если есть вложения, передаем их в callAI
            const responseText = await callAI({
                baseUrl,
                apiKey: key,
                model,
                systemPrompt: systemInstruction,
                history,
                userMessage,
                attachments: attachments.length > 0 ? attachments : undefined
            });

            // --- Обработка всех тегов ---
            const completeRegex = /\[COMPLETE_TASK:\s*"([^"]+)"\]/g;
            const editRegex = /\[EDIT_TASK_POINTS:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
            const addTaskRegex = /\[ADD_TASK:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
            const addCalendarTaskRegex = /\[ADD_CALENDAR_TASK:\s*"([^"]+)"\s*\|\s*(\d+)\s*\|\s*"([^"]+)"\]/g;
            const addRegularTaskRegex = /\[ADD_REGULAR_TASK:\s*"([^"]+)"\s*\|\s*(\d+)\s*\|\s*"([^"]+)"\]/g;
            const deleteTaskRegex = /\[DELETE_TASK:\s*"([^"]+)"\]/g;
            const addRewardRegex = /\[ADD_REWARD:\s*"([^"]+)"\s*\|\s*(\d+)\]/g;
            const deleteRewardRegex = /\[DELETE_REWARD:\s*"([^"]+)"\]/g;
            const buyRewardRegex = /\[BUY_REWARD:\s*"([^"]+)"\]/g;
            const usePurchaseRegex = /\[USE_PURCHASE:\s*"([^"]+)"\]/g;

            let cleanResponse = responseText;
            let match;

            // Утилита: найти задачу по ID, номеру (#N) или частичному названию
            const findTask = (ref) => {
                const currentTasks = useStore.getState().tasks;
                const pending = currentTasks.filter(t => !t.completed);
                // По ID
                let found = currentTasks.find(t => t.id === ref);
                if (found) return found;
                // По номеру (#2)
                const numMatch = ref.match(/^#?(\d+)$/);
                if (numMatch) {
                    const idx = parseInt(numMatch[1], 10) - 1;
                    if (idx >= 0 && idx < pending.length) return pending[idx];
                }
                // По названию (нечёткий поиск)
                const lower = ref.toLowerCase();
                found = currentTasks.find(t => t.title.toLowerCase() === lower);
                if (found) return found;
                found = currentTasks.find(t => t.title.toLowerCase().includes(lower));
                return found || null;
            };

            // Утилита: найти награду по ID, номеру или названию
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

            // COMPLETE_TASK
            while ((match = completeRegex.exec(responseText)) !== null) {
                const task = findTask(match[1]);
                if (task && !task.completed) {
                    useStore.getState().toggleTask(task.id);
                    useStore.getState().addTokens(task.value);
                }
            }

            // EDIT_TASK_POINTS
            while ((match = editRegex.exec(responseText)) !== null) {
                const task = findTask(match[1]);
                if (task) useStore.getState().editTaskPoints(task.id, parseInt(match[2], 10));
            }

            // ADD_TASK
            while ((match = addTaskRegex.exec(responseText)) !== null) {
                useStore.getState().addProposal(match[1], parseInt(match[2], 10));
            }

            // ADD_CALENDAR_TASK
            while ((match = addCalendarTaskRegex.exec(responseText)) !== null) {
                const title = match[1];
                const pts = parseInt(match[2], 10);
                const dateStr = match[3];
                useStore.getState().addCalendarTask(dateStr, title, pts);
            }

            // ADD_REGULAR_TASK
            while ((match = addRegularTaskRegex.exec(responseText)) !== null) {
                const title = match[1];
                const pts = parseInt(match[2], 10);
                const period = match[3];
                useStore.getState().addRegularTask(title, pts, period);
            }

            // DELETE_TASK
            while ((match = deleteTaskRegex.exec(responseText)) !== null) {
                const task = findTask(match[1]);
                if (task) useStore.getState().deleteTaskWithReason(task.id, 'Удалено по запросу через Nova');
            }

            // ADD_REWARD
            while ((match = addRewardRegex.exec(responseText)) !== null) {
                useStore.getState().addRewardProposal(match[1], parseInt(match[2], 10));
            }

            // DELETE_REWARD
            while ((match = deleteRewardRegex.exec(responseText)) !== null) {
                const reward = findReward(match[1]);
                if (reward) {
                    useStore.getState().deleteRewardWithReason(reward.id, 'Удалено по запросу через Nova');
                    useStore.getState().addToast(`Награда "${reward.title}" удалена`, 'info');
                }
            }

            // BUY_REWARD
            while ((match = buyRewardRegex.exec(responseText)) !== null) {
                const reward = findReward(match[1]);
                if (reward) useStore.getState().buyRewardById(reward.id);
            }

            // USE_PURCHASE
            while ((match = usePurchaseRegex.exec(responseText)) !== null) {
                useStore.getState().usePurchase(match[1]);
            }

            cleanResponse = cleanResponse
                .replace(completeRegex, '').replace(editRegex, '')
                .replace(addTaskRegex, '').replace(addCalendarTaskRegex, '')
                .replace(deleteTaskRegex, '')
                .replace(addRewardRegex, '').replace(deleteRewardRegex, '')
                .replace(buyRewardRegex, '').replace(usePurchaseRegex, '')
                .trim();

            addMessage({ role: 'assistant', content: cleanResponse });
        } catch (error) {
            console.error("AI Error:", error);

            // Если ошибка связана с квотой (429 Тоо Many Requests)
            if (error.message.includes('429') || error.message.includes('Quota exceeded')) {
                addMessage({
                    role: 'assistant',
                    content: `Упс! ⏳ Кажется, мы исчерпали лимит запросов нейросети на эту минуту.\n\nДавайте сделаем крошечную паузу, и через минуту я снова буду с вами! (Также вы можете сменить ключ или модель в настройках)`
                });
            } else {
                addMessage({
                    role: 'assistant',
                    content: `Ошибка при обращении к ИИ: ${error.message}. Проверьте правильность настроек API.`
                });
            }
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() && attachments.length === 0) return;

        const userMsg = input.trim();
        const currentAttachments = [...attachments];

        setInput('');
        setAttachments([]);

        // Формируем контент для локального отображения в чате (с превьюшками файлов)
        let displayContent = userMsg;
        if (currentAttachments.length > 0) {
            const parts = [];
            if (userMsg) parts.push({ type: 'text', text: userMsg });
            currentAttachments.forEach(att => {
                if (att.type === 'image') {
                    parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.base64}` } });
                } else {
                    parts.push({ type: 'text', text: `\n📎 Файл: ${att.name}` });
                }
            });
            displayContent = parts;
        }

        addMessage({ role: 'user', content: displayContent });
        setIsTyping(true);

        await generateAIResponse(userMsg, currentAttachments);
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

    // --- Обработка файлов ---
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        processFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processFiles = (files) => {
        const newAttachments = [];
        let filesProcessed = 0;

        files.forEach(file => {
            const reader = new FileReader();

            if (file.type.startsWith('image/')) {
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    newAttachments.push({
                        id: Date.now() + Math.random(),
                        name: file.name,
                        type: 'image',
                        mimeType: file.type,
                        base64: base64Data,
                        preview: e.target.result
                    });

                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        setAttachments(prev => [...prev, ...newAttachments]);
                    }
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
                reader.onload = (e) => {
                    newAttachments.push({
                        id: Date.now() + Math.random(),
                        name: file.name,
                        type: 'file',
                        mimeType: file.type || 'text/plain',
                        textContent: e.target.result
                    });

                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        setAttachments(prev => [...prev, ...newAttachments]);
                    }
                };
                reader.readAsText(file);
            } else {
                addMessage({
                    role: 'system',
                    content: `[ОШИБКА] Файл "${file.name}" не поддерживается. Разрешены только изображения и текстовые файлы.`
                });
                filesProcessed++;
                if (filesProcessed === files.length && newAttachments.length > 0) {
                    setAttachments(prev => [...prev, ...newAttachments]);
                }
            }
        });
    };

    const removeAttachment = (id) => {
        setAttachments(prev => prev.filter(att => att.id !== id));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handlePaste = (e) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            const files = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    files.push(items[i].getAsFile());
                }
            }
            if (files.length > 0) {
                e.preventDefault(); // Предотвращаем вставку в текстовое поле, так как это файл
                processFiles(files);
            }
        }
    };

    // Рендер сообщения с поддержкой массива (текст + картинки/файлы)
    const renderMessageContent = (msg) => {
        if (Array.isArray(msg.content)) {
            return (
                <div className="flex flex-col gap-2">
                    {msg.content.map((part, idx) => {
                        if (part.type === 'text') {
                            return <div key={idx} className="whitespace-pre-wrap break-words">{part.text}</div>;
                        } else if (part.type === 'image_url') {
                            return (
                                <img
                                    key={idx}
                                    src={part.image_url.url}
                                    alt="Вложение"
                                    className="max-w-full h-auto max-h-[300px] rounded-lg object-contain shadow-sm border border-white/10"
                                />
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        return msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.content}</div> : <ReactMarkdown>{msg.content}</ReactMarkdown>;
    };

    return (
        <div
            className="flex flex-col h-full bg-black/20 rounded-inherit overflow-hidden relative"
            style={{ maxHeight: '100%' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag & Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm border-2 border-dashed border-accent flex flex-col items-center justify-center rounded-3xl m-2">
                    <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-4 animate-pulse">
                        <ImageIcon size={40} className="text-accent" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-white">Отпустите файлы здесь</h2>
                    <p className="text-text-secondary">Поддерживаются изображения и текстовые файлы</p>
                </div>
            )}

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
                        onClick={() => setShowConfirmLogs(true)}
                        className="p-2 rounded-full transition-all text-text-secondary hover:text-warning hover:bg-warning/10 hover:scale-110"
                        title="Очистить системные логи"
                    >
                        <Trash2 size={18} />
                    </button>
                    <button
                        onClick={() => setShowConfirmChat(true)}
                        className="p-2 rounded-full transition-all text-text-secondary hover:text-danger hover:bg-danger/10 hover:rotate-12 hover:scale-110"
                        title="Очистить весь чат"
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
                                            <div className={`p-3 rounded-2xl text-sm shadow-sm break-words overflow-hidden ${msg.role === 'user'
                                                ? 'bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-none'
                                                : 'bg-accent/10 border border-accent/20 text-text-primary rounded-tl-none markdown-content'
                                                }`}>
                                                {renderMessageContent(msg)}
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
            <div className="p-4 border-t border-border bg-[#0d0d12] relative z-10">

                {/* Отдельная панель превью файлов над инпутом */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 mb-3 bg-black/30 p-2.5 rounded-xl border border-border/50 overflow-x-auto custom-scrollbar">
                        {attachments.map(att => (
                            <div key={att.id} className="relative shrink-0 group">
                                {att.type === 'image' ? (
                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                                        <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-black/50 border border-border flex flex-col items-center justify-center p-1">
                                        <FileText size={20} className="text-blue-400 mb-1" />
                                        <span className="text-[9px] text-text-secondary truncate w-full text-center px-1" title={att.name}>
                                            {att.name}
                                        </span>
                                    </div>
                                )}
                                <button
                                    onClick={() => removeAttachment(att.id)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    type="button"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSend} className="relative flex items-end bg-[#13131a] border border-border/70 rounded-2xl pl-2 pr-14 py-1 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 transition-all shadow-inner">

                    {/* Кнопка скрепки */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        multiple
                        accept="image/*,.txt,.md,.json,.csv"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 mb-0.5 text-text-secondary hover:text-white transition-colors rounded-full shrink-0"
                        title="Прикрепить файл или фото"
                    >
                        <Paperclip size={20} />
                    </button>

                    <textarea
                        placeholder={attachments.length > 0 ? "Добавить описание..." : "Написать Nova... (или перетащите сюда картинку)"}
                        className="w-full bg-transparent border-none pl-2 pr-2 py-3 text-sm outline-none text-white placeholder:text-text-secondary resize-none custom-scrollbar"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
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
                        disabled={(!input.trim() && attachments.length === 0) || isTyping}
                        className="absolute right-2 bottom-2 p-2 rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex justify-center items-center h-9 w-9"
                    >
                        <Send size={16} className="-ml-0.5" />
                    </button>
                </form>
            </div>

            <ConfirmModal
                isOpen={showConfirmLogs}
                onClose={() => setShowConfirmLogs(false)}
                onConfirm={() => {
                    useStore.getState().clearSystemLogs();
                    addToast("Системные логи очищены", "info");
                }}
                title="Очистить системные логи?"
                description="Все записи о выполненных действиях ИИ будут удалены из истории чата."
            />

            <ConfirmModal
                isOpen={showConfirmChat}
                onClose={() => setShowConfirmChat(false)}
                onConfirm={() => {
                    clearMessages();
                    addToast("Чат успешно очищен", "success");
                }}
                title="Очистить чат с Nova?"
                description="Вся история переписки будет безвозвратно удалена. Будет начат новый диалог."
            />
        </div>
    );
}
