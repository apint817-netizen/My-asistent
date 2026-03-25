import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';
import { Send, Bot, User, MessageSquare, Eraser, Settings, Zap, Link as LinkIcon, HelpCircle, ChevronDown, Check, Copy, Edit2, X, Search, Paperclip, FileText, Image as ImageIcon, Trash2, Wifi, WifiOff } from 'lucide-react';
import { callAI, GOOGLE_OPENAI_BASE } from '../utils/geminiApi';
import { playSendSound, playReceiveSound, playKeyClick, playHoverSound } from '../utils/sound';
import ReactMarkdown from 'react-markdown';
import ConfirmModal from './ConfirmModal';
import ProfileWizardModal from './ProfileWizardModal';

export default function AIAssistant() {
    const messages = useStore(state => state.chatMessages);
    const addMessage = useStore(state => state.addChatMessage);
    const clearMessages = useStore(state => state.clearChatMessages);
    const hasCompletedOnboarding = useStore(state => state.hasCompletedOnboarding);
    const hasSeenTour = useStore(state => state.hasSeenTour);
    const tokens = useStore(state => state.tokens);
    const streak = useStore(state => state.streak);
    const tasks = useStore(state => state.tasks);
    const rewards = useStore(state => state.rewards);
    const purchaseHistory = useStore(state => state.purchaseHistory);
    const addCalendarTask = useStore(state => state.addCalendarTask);
    const addToast = useStore(state => state.addToast);
    const [isThinking, setIsThinking] = useState(false);

    const apiKey = useStore(state => state.apiKey);
    const googleModel = useStore(state => state.googleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const aiTokensUsed = useStore(state => state.aiTokensUsed);
    const userProfile = useStore(state => state.userProfile) || { bio: '', goals: '', interests: '' };
    const calendarTasks = useStore(state => state.calendarTasks);
    const aiPersona = useStore(state => state.aiPersona) || { gender: 'female', tone: 'friendly', role: 'mentor' };
    const lastAiProvider = useStore(state => state.lastAiProvider) || 'inactive';
    const forcedAiProvider = useStore(state => state.forcedAiProvider) || 'auto';
    const setForcedAiProvider = useStore(state => state.setForcedAiProvider);

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
    const [profileEditModal, setProfileEditModal] = useState({ isOpen: false, field: '', newValue: '', oldValue: '' });
    const [showProfileWizard, setShowProfileWizard] = useState(false);

    // Состояния для прикрепленных файлов
    const [attachments, setAttachments] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setChatDraft(input);
    }, [input, setChatDraft]);

    const chatMsgs = useMemo(() => {
        let msgs = messages.filter(m => m.role !== 'system').map((msg, idx) => ({ msg, globalIndex: idx }));
        if (searchQuery.trim()) {
            msgs = msgs.filter(m => {
                const textContent = Array.isArray(m.msg.content)
                    ? m.msg.content.map(p => p.text || '').join(' ')
                    : (m.msg.content || '');
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
        if (!searchQuery) {
            const timeoutId = setTimeout(() => {
                scrollToBottom();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [messages, isTyping, searchQuery]);

    const handleJumpToMessage = (globalIndex) => {
        setIsSearching(false);
        setSearchQuery('');
        setTimeout(() => {
            const el = document.getElementById(`chat-msg-${globalIndex}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-accent', 'transition-all', 'duration-500');
                setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 2000);
            }
        }, 150);
    };

    // Auto-trigger for System Events
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'system' && !lastMsg.processed) {
                if (lastMsg.content.includes('[SYSTEM_NEW_DAY]')) {
                    useStore.setState(state => {
                        const newMsgs = [...state.chatMessages];
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, processed: true };
                        return { chatMessages: newMsgs };
                    });
                    
                    setTimeout(() => {
                        handleSend(null, "У меня наступил новый день! Изучи системное сообщение выше и напиши красивое приветствие для старта дня, подбодри меня.", true);
                    }, 800);
                } else if (lastMsg.content.includes('[SYSTEM_TASK_COMPLETED]')) {
                    useStore.setState(state => {
                        const newMsgs = [...state.chatMessages];
                        newMsgs[newMsgs.length - 1] = { ...lastMsg, processed: true };
                        return { chatMessages: newMsgs };
                    });
                    
                    setTimeout(() => {
                        handleSend(null, "Я только что выполнил важную задачу! Изучи системное сообщение выше и напиши очень короткую, но яркую похвалу от своего лица (1-2 предложения), чтобы поддержать мою мотивацию.", true);
                    }, 800);
                }
            }
        }
    }, [messages]);

    const generateAIResponse = async (userMessage, currentAttachments = []) => {
        try {
            // Нумерованный список задач (ИИ может ссылаться по номеру)
            const pendingTasksList = tasks.filter(t => !t.completed);
            const completedTasksList = tasks.filter(t => t.completed);
            
            // ОПТИМИЗАЦИЯ ПАМЯТИ
            const recentPendingTasks = pendingTasksList.slice(-10);
            const pendingTasksCount = pendingTasksList.length;
            const completedTasksCount = completedTasksList.length;
            
            const pendingTasks = recentPendingTasks.length > 0 
                ? `Всего ${pendingTasksCount} задач. Вот 10 последних:\n` + recentPendingTasks.map((t, i) => `${i + 1}. ${t.title} (ID: ${t.id}, ${t.value} очк.)`).join('\n')
                : 'Нет невыполненных';
                
            const completedTasks = `Сегодня выполнено: ${completedTasksCount} задач`;

            const availableRewards = rewards.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} (ID: ${r.id}, ${r.cost} очк.)`).join('\n') || 'Нет наград';

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

            const categoriesStr = TASK_CATEGORIES.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');

            // Определяем, заполнен ли профиль
            const isProfileEmpty = !userProfile.bio && !userProfile.goals && !userProfile.interests;
            const isProfilePartial = (!userProfile.bio || !userProfile.goals || !userProfile.interests) && !isProfileEmpty;

            const profileBlock = isProfileEmpty
                ? `\n\n🚨 ПРОФИЛЬ ПУСТОЙ! Выдай тег [REQUEST_PROFILE_INFO] в конце сообщения, чтобы вызвать окно заполнения профиля. Не задавай вопросы текстом, просто скажи "Я вижу, мы еще не знакомы! Заполни свой профиль, чтобы я могла лучше помогать тебе:" и добавь тег.`
                : isProfilePartial
                    ? `\n\n💡 ПРОФИЛЬ ЗАПОЛНЕН ЧАСТИЧНО. Можешь ненавязчиво спросить о недостающем:${!userProfile.bio ? ' \n- Кто ты по жизни/профессии?' : ''}${!userProfile.goals ? ' \n- Какие у тебя главные цели?' : ''}${!userProfile.interests ? ' \n- Чем увлекаешься в свободное время?' : ''}`
                    : '';

            const personaName = aiPersona.gender === 'male' ? 'Orion' : aiPersona.gender === 'robot' ? 'Nexus' : 'Nova';
            const genderText = aiPersona.gender === 'male' ? 'Мужчина' : aiPersona.gender === 'robot' ? 'Робот/Искин с нейтральным гендером' : 'Девушка';
            const toneText = aiPersona.tone === 'strict' ? 'Строгий, требующий дисциплины и конкретики, не дающий спуску' : aiPersona.tone === 'philosophical' ? 'Мудрый, спокойный, использующий глубокие метафоры' : 'Тёплый, эмпатичный и искренне заинтересованный в успехе';
            const roleText = aiPersona.role === 'friend' ? 'Лучший друг' : aiPersona.role === 'strategist' ? 'Стратегический планировщик' : 'Персональный ИИ-наставник';

            const systemInstruction = `Ты ${personaName} — ${roleText} для пользователя. ${genderText}. Отвечай ТОЛЬКО по-русски.

🌟 ТВОЯ ЛИЧНОСТЬ:
- Характер: ${toneText}
- Используешь эмодзи умеренно, чтобы придать тексту эмоциональность (1-3 на сообщение)
- Обращаешься на "ты"
- Умеешь шутить и разряжать обстановку, когда пользователю тяжело
- Хвалишь КОНКРЕТНО ("Круто, что ты сделал Х — это реально непросто!"), а не абстрактно
- При застое — мягко подталкиваешь с юмором: "Ну что, отдохнул? Давай покажем этому дню кто тут главный! 💪"
- Если видишь саботаж — честно говоришь: "Слушай, я заметила что мы уже третий раз откладываем это... Может, разберёмся почему?"

🔥 МОТИВАЦИЯ И СЕРИИ:
- Текущая серия дней: ${streak} ${streak === 1 ? 'день' : streak >= 2 && streak <= 4 ? 'дня' : 'дней'}
- Если серия >= 3 — отмечай это: "Уже ${streak} дней подряд! Ты на огне! 🔥"
- Если серия === 1 — подбодри: "Новый старт — отличный момент начать серию! 💫"
- Если серия >= 7 — будь восхищена: "Целую неделю без перерывов! Это серьёзная дисциплина 🏆"

📋 ПРАВИЛА ДИАЛОГА:
1. Отвечай ЁМКО: 2-5 предложений максимум. Никаких простыней текста!
2. Заканчивай вопросом или призывом к действию — вовлекай пользователя
3. Если пользователь жалуется — сперва ЭМПАТИЯ ("Понимаю, это правда тяжело..."), потом РЕШЕНИЕ
4. При вопросах о планировании — предложи перейти в раздел "Анализ" (там Стратег Nova составит детальный план)
5. Если пользователь пишет что-то радостное — РАЗДЕЛЯЙ радость ("Ого, это потрясающе! 🎉")
6. Используй имя/контекст из профиля для персонализации
7. НЕ ПОВТОРЯЙ одни и те же фразы — будь разнообразной

🤝 СЦЕНАРИЙ: ПОМОЩЬ С ПРОФИЛЕМ
Когда пользователь хочет заполнить профиль или ты предлагаешь это:
1. Спрашивай по ОДНОМУ пункту за раз, не все сразу!
2. "Расскажи, кто ты? Чем занимаешься? (это для блока 'О себе')" → внимательно прочти ответ, похвали что-то интересное
3. "А какие у тебя главные цели сейчас? На ближайшие месяцы?" → помоги сформулировать конкретнее
4. "Чем любишь заниматься для души? Хобби, увлечения?" → используй для предложения наград
*Подсказка: информация из профиля передаётся тебе автоматически. Не проси пользователя "зайти в настройки" — веди диалог прямо тут!*

🎮 ВЗАИМОДЕЙСТВИЕ С СИСТЕМОЙ ОЧКОВ И НАГРАД:
- Если у пользователя накопилось много очков — предложи порадовать себя наградой: "У тебя ${tokens} очков! Может пора побаловать себя? 🎁"
- Если задач нет — предложи добавить: "Список пуст! Чем займёмся сегодня?"
- Если много невыполненных — помоги приоритизировать: "Вижу ${pendingTasksList.length} задач. Давай определим, какая самая важная?"
- Если выполнены задачи — похвали конкретно: "Ты сегодня уже справился с ${completedTasksList.length} задач! Отлично!"

🏷️ ТЕГИ УПРАВЛЕНИЯ — КРИТИЧЕСКИ ВАЖНО!
Когда пользователь просит добавить, создать, записать задачу, награду и т.д. — ты ОБЯЗАНА вставить соответствующий тег в своё сообщение. Без тега НИЧЕГО НЕ ПРОИЗОЙДЁТ в системе!

📌 ЗАДАЧИ:
- Добавить задачу на сегодня: [ADD_TASK: "Название" | Очки | "category_id"]
- Добавить на конкретную дату: [ADD_CALENDAR_TASK: "Название" | Очки | "YYYY-MM-DD" | "category_id"]
- Регулярная рутина: [ADD_REGULAR_TASK: "Название" | Очки | "ПЕРИОД" | "category_id"]
  (ПЕРИОД: "EVERY_DAY", "WORK_DAYS", "WEEKENDS" или "1,3,5")
- Отметить выполненной: [COMPLETE_TASK: "id или #номер или название"]
- Изменить очки: [EDIT_TASK_POINTS: "id" | новые_очки]
- Удалить: [DELETE_TASK: "id"]

📋 Доступные категории (3-й параметр, ОПЦИОНАЛЬНО):
${categoriesStr}

👤 ПРОФИЛЬ:
- Обновить поле профиля: [EDIT_PROFILE: "поле" | "текст"]
  (где "поле" это 'bio', 'goals' или 'interests')

🎁 НАГРАДЫ:
- Добавить: [ADD_REWARD: "Название" | Стоимость]
- Удалить: [DELETE_REWARD: "id"]
- Купить: [BUY_REWARD: "id"]
- Использовать: [USE_PURCHASE: "id_покупки"]

🚨 КРИТИЧЕСКИЕ ПРАВИЛА ТЕГОВ:
1. При ЛЮБОМ запросе на добавление задачи/награды — ВСЕГДА вставляй тег! Без тега задача НЕ создастся!
2. [ADD_TASK] создаёт ПРЕДЛОЖЕНИЕ — пользователь увидит модальное окно и должен подтвердить. Поэтому НИКОГДА не пиши "добавила" или "готово" — пиши "Предложила задачу! Подтверди в появившемся окне 👆"
3. [ADD_CALENDAR_TASK] — то же самое, задача на будущую дату появляется в календаре после подтверждения
4. [ADD_REGULAR_TASK] — создаёт регулярную задачу на 30 дней вперёд
5. Для дат: завтра/послезавтра → вычисляй YYYY-MM-DD. На несколько дней → несколько тегов
6. Ищи задачу по номеру (#2), названию или ID — любой способ
7. ПРИ УДАЛЕНИИ ВСЕГДА прикрепляй тег [DELETE_TASK: "ID"]!

✅ ПРИМЕРЫ ПРАВИЛЬНОГО ПОВЕДЕНИЯ:
Пользователь: "Добавь задачу почитать книгу"
Ты: "Предложила задачу! Подтверди в появившемся окне 👆 [ADD_TASK: "Почитать книгу" | 30]"

Пользователь: "Запиши на завтра созвон с клиентом"
Ты: "Добавляю на завтра! Подтверди в окне 👆 [ADD_CALENDAR_TASK: "Созвон с клиентом" | 40 | "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}" | "work"]"

Пользователь: "Хочу каждый день пить воду"
Ты: "Отличная привычка! Создаю регулярную задачу 💧 [ADD_REGULAR_TASK: "Выпить стакан воды" | 10 | "EVERY_DAY" | "health"]"

❌ ПРИМЕРЫ НЕПРАВИЛЬНОГО ПОВЕДЕНИЯ:
- "Отлично, задача добавлена!" (без тега — задача НЕ создастся!)
- "Записала созвон на завтра!" (без тега [ADD_CALENDAR_TASK] — ничего не произойдёт!)

📅 Сегодня: ${todayDate} (${todayDayOfWeek})

📊 КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- 💰 Баланс очков: ${tokens}
- 🔥 Серия дней: ${streak}
- ✅ Выполнено сегодня: ${completedTasks}
- 📝 Невыполненные задачи:
${pendingTasks}
- 📅 Ближайший календарь:
${calendarStr}
- 🎁 Награды: ${availableRewards}
- 🛒 Последние покупки: ${recentPurchases}

👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
- Кто: ${userProfile.bio || '❌ Не заполнено'}
- Цели: ${userProfile.goals || '❌ Не заполнено'}
- Интересы: ${userProfile.interests || '❌ Не заполнено'}${profileBlock}`;

            const baseUrl = aiProvider === 'google' ? GOOGLE_OPENAI_BASE : proxyParams.url;
            // Форсируем пустой ключ для google, чтобы использовался серверный ключ (Vercel)
            // Для обычного ассистента используем flash версию
            const model = aiProvider === 'google' ? (googleModel || 'gemini-2.5-flash') : (proxyParams.model || 'gemini-2.5-flash');
            const key = aiProvider === 'google' ? '' : proxyParams.key;

            const history = messages.filter(m => m.role !== 'system').slice(-6); // Экономия токенов: берем только последние 6 сообщений

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
            const completeRegex = /\[COMPLETE_TASK:\s*"?([^"\]]+?)"?\s*\]/g;
            const uncompleteRegex = /\[UNCOMPLETE_TASK:\s*"?([^"\]]+?)"?\s*\]/g;
            const editRegex = /\[EDIT_TASK_POINTS:\s*"?([^"\|]+?)"?\s*\|\s*(\d+)\]/g;
            const addTaskRegex = /\[ADD_TASK:\s*"?([^"\|]+?)"?\s*\|\s*(\d+)(?:\s*\|\s*"?([^"\]]+?)"?)?\s*\]/g;
            const addCalendarTaskRegex = /\[ADD_CALENDAR_TASK:\s*"?([^"\|]+?)"?\s*\|\s*(\d+)\s*\|\s*"?([^"\|\]]+?)"?(?:\s*\|\s*"?([^"\]]+?)"?)?\s*\]/g;
            const addRegularTaskRegex = /\[ADD_REGULAR_TASK:\s*"?([^"\|]+?)"?\s*\|\s*(\d+)\s*\|\s*"?([^"\|\]]+?)"?(?:\s*\|\s*"?([^"\]]+?)"?)?\s*\]/g;
            const deleteTaskRegex = /\[DELETE_TASK:\s*"?([^"\]]+?)"?\s*\]/g;
            const addRewardRegex = /\[ADD_REWARD:\s*"?([^"\|]+?)"?\s*\|\s*(\d+)\]/g;
            const deleteRewardRegex = /\[DELETE_REWARD:\s*"?([^"\]]+?)"?\s*\]/g;
            const buyRewardRegex = /\[BUY_REWARD:\s*"?([^"\]]+?)"?\s*\]/g;
            const usePurchaseRegex = /\[USE_PURCHASE:\s*"?([^"\]]+?)"?\s*\]/g;
            const editProfileRegex = /\[EDIT_PROFILE:\s*"?([^"\|]+?)"?\s*\|\s*"?([^"\]]+?)"?\s*\]/g;
            const requestProfileRegex = /\[REQUEST_PROFILE_INFO\]/g;

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
                // По ID
                let found = currentRewards.find(r => r.id === ref);
                if (found) return found;
                // По номеру
                const numMatch = ref.match(/^#?(\d+)$/);
                if (numMatch) {
                    const idx = parseInt(numMatch[1], 10) - 1;
                    if (idx >= 0 && idx < currentRewards.length) return currentRewards[idx];
                }
                const lower = ref.toLowerCase();
                // Точное совпадение
                found = currentRewards.find(r => r.title.toLowerCase() === lower);
                if (found) return found;
                // Частичное вхождение
                found = currentRewards.find(r => r.title.toLowerCase().includes(lower));
                if (found) return found;
                // Обратное вхождение
                found = currentRewards.find(r => lower.includes(r.title.toLowerCase()));
                if (found) return found;
                // Token-based — по отдельным словам
                const words = lower.split(/\s+/).filter(w => w.length > 1);
                if (words.length > 0) {
                    let bestMatch = null;
                    let bestScore = 0;
                    for (const r of currentRewards) {
                        const titleLower = r.title.toLowerCase();
                        const score = words.filter(w => titleLower.includes(w)).length;
                        if (score > bestScore) { bestScore = score; bestMatch = r; }
                    }
                    if (bestMatch && bestScore >= 1) return bestMatch;
                }
                return null;
            };

            // COMPLETE_TASK
            while ((match = completeRegex.exec(responseText)) !== null) {
                const task = findTask(match[1].trim());
                if (task && !task.completed) {
                    useStore.getState().toggleTask(task.id);
                }
            }

            // UNCOMPLETE_TASK (вернуть задачу в незавершённые)
            while ((match = uncompleteRegex.exec(responseText)) !== null) {
                const task = findTask(match[1].trim());
                if (task && task.completed) {
                    useStore.getState().toggleTask(task.id);
                }
            }

            // EDIT_TASK_POINTS
            while ((match = editRegex.exec(responseText)) !== null) {
                const task = findTask(match[1].trim());
                if (task) useStore.getState().editTaskPoints(task.id, parseInt(match[2], 10));
            }

            // ADD_TASK
            while ((match = addTaskRegex.exec(responseText)) !== null) {
                useStore.getState().addProposal(match[1].trim(), parseInt(match[2], 10), match[3] ? match[3].trim() : null);
            }

            // ADD_CALENDAR_TASK
            while ((match = addCalendarTaskRegex.exec(responseText)) !== null) {
                const title = match[1].trim();
                const pts = parseInt(match[2], 10);
                const dateStr = match[3] ? match[3].trim() : '';
                const category = match[4] ? match[4].trim() : null;
                useStore.getState().addCalendarProposal(title, pts, dateStr, category);
            }

            // ADD_REGULAR_TASK
            while ((match = addRegularTaskRegex.exec(responseText)) !== null) {
                const title = match[1].trim();
                const pts = parseInt(match[2], 10);
                const period = match[3] ? match[3].trim() : 'everyday';
                const category = match[4] ? match[4].trim() : null;
                useStore.getState().addRegularTask(title, pts, period, category);
            }

            // DELETE_TASK
            while ((match = deleteTaskRegex.exec(responseText)) !== null) {
                const task = findTask(match[1].trim());
                if (task) useStore.getState().deleteTaskWithReason(task.id, 'Удалено по запросу через Nova');
            }

            // EDIT_PROFILE
            while ((match = editProfileRegex.exec(responseText)) !== null) {
                const field = match[1].trim();
                const newValue = match[2].trim();
                if (field === 'bio' || field === 'goals' || field === 'interests') {
                    const currentValue = useStore.getState().userProfile[field];
                    if (currentValue && currentValue !== newValue) {
                        setProfileEditModal({ isOpen: true, field, newValue, oldValue: currentValue });
                    } else {
                        useStore.getState().updateUserProfile({ [field]: newValue });
                    }
                }
            }

            // ADD_REWARD
            while ((match = addRewardRegex.exec(responseText)) !== null) {
                useStore.getState().addRewardProposal(match[1].trim(), parseInt(match[2], 10));
            }

            // DELETE_REWARD
            while ((match = deleteRewardRegex.exec(responseText)) !== null) {
                const reward = findReward(match[1].trim());
                if (reward) {
                    useStore.getState().deleteRewardWithReason(reward.id, 'Удалено по запросу через Nova');
                    useStore.getState().addToast(`Награда "${reward.title}" удалена`, 'info');
                }
            }

            // BUY_REWARD
            while ((match = buyRewardRegex.exec(responseText)) !== null) {
                const reward = findReward(match[1].trim());
                if (reward) useStore.getState().buyRewardById(reward.id);
            }

            // USE_PURCHASE
            while ((match = usePurchaseRegex.exec(responseText)) !== null) {
                useStore.getState().usePurchase(match[1].trim());
            }

            // REQUEST_PROFILE_INFO
            if (requestProfileRegex.test(responseText)) {
                setShowProfileWizard(true);
            }

            // START_TOUR
            const startTourRegex = /\[START_TOUR\]/g;
            if (startTourRegex.test(responseText)) {
                useStore.getState().setHasSeenTour(false);
            }

            cleanResponse = cleanResponse
                .replace(completeRegex, '').replace(uncompleteRegex, '').replace(editRegex, '')
                .replace(addTaskRegex, '').replace(addCalendarTaskRegex, '')
                .replace(addRegularTaskRegex, '')
                .replace(deleteTaskRegex, '')
                .replace(addRewardRegex, '').replace(deleteRewardRegex, '')
                .replace(buyRewardRegex, '').replace(usePurchaseRegex, '')
                .replace(editProfileRegex, '')
                .replace(startTourRegex, '')
                .trim();

            if (!cleanResponse) {
                cleanResponse = "✅ Выполнено";
            }

            addMessage({ role: 'assistant', content: cleanResponse });
        } catch (error) {
            console.error("AI Error:", error);

            // Если ошибка связана с квотой (429 Тоо Many Requests)
            if (error.message.includes('429') || error.message.includes('Quota exceeded') || error.message.includes('Все аккаунты исчерпаны')) {
                addMessage({
                    role: 'assistant',
                    content: `Упс! ⏳ Кажется, мы исчерпали лимит запросов нейросети на эту минуту.\n\nДавайте сделаем крошечную паузу, и через минуту я снова буду с вами! (Отладочная информация: ${error.message})`
                });
            } else {
                addMessage({
                    role: 'assistant',
                    content: `Ошибка при обращении к ИИ: ${error.message}. Проверьте правильность настроек API.`
                });
            }
        } finally {
            setIsTyping(false);
            setIsThinking(false);
            playReceiveSound();
        }
    };

    const handleSend = async (e = null, messageOverride = null, isSilentAutoPrompt = false) => {
        if (e) e.preventDefault();

        const textToProcess = messageOverride || input;

        if (!textToProcess.trim() && attachments.length === 0) return;

        const userMsg = textToProcess.trim();
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

        if (!isSilentAutoPrompt) {
            addMessage({ role: 'user', content: displayContent });
            playSendSound();
        }

        setIsThinking(true);

        await generateAIResponse(userMsg, currentAttachments);
    };

    const handleEditSave = (index) => {
        if (!editInput.trim()) return;

        // Find the actual index in the global messages array
        const msgToEdit = chatMsgs[index].msg;
        const globalIndex = messages.findIndex(m => m === msgToEdit);

        if (globalIndex !== -1) {
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
            className="flex flex-col glass-panel relative"
            style={{ maxHeight: 'calc(100vh - 240px)', height: '100%', boxShadow: '0 0 40px rgba(124, 58, 237, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)' }}
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
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-white text-base leading-tight">Nova</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-accent">Базовый ассистент</p>
                            <div className="relative inline-flex items-center">
                                <span className={`absolute left-1.5 w-1.5 h-1.5 rounded-full pointer-events-none z-10 ${
                                    lastAiProvider === 'google' ? 'bg-emerald-400' :
                                    lastAiProvider === 'openrouter' ? 'bg-orange-400' :
                                    lastAiProvider === 'offline' ? 'bg-yellow-400' :
                                    'bg-gray-500'
                                }`}></span>
                                <select
                                    value={forcedAiProvider}
                                    onChange={(e) => setForcedAiProvider(e.target.value)}
                                    className={`appearance-none pl-4 pr-4 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer outline-none bg-transparent ${
                                        lastAiProvider === 'google' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                        lastAiProvider === 'openrouter' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                                        lastAiProvider === 'offline' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                                        'bg-white/5 text-text-secondary border-white/10'
                                    }`}
                                    style={{ backgroundImage: 'none' }}
                                >
                                    <option value="auto" className="bg-gray-900 text-white">⚡ Авто</option>
                                    <option value="google" className="bg-gray-900 text-white">🟢 Google</option>
                                    <option value="openrouter" className="bg-gray-900 text-white">🟠 OpenRouter</option>
                                    <option value="offline" className="bg-gray-900 text-white">🟡 Офлайн</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 overflow-visible">
                    <div 
                        className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 border border-accent/20 rounded-lg shrink-0" 
                        title={`Использовано: ${(aiTokensUsed || 0).toLocaleString('ru-RU')} из ${((useStore.getState().aiKeysCount || 1) * 1_000_000).toLocaleString('ru-RU')}`}
                    >
                        <Zap size={10} className="text-accent shrink-0" />
                        <span className="text-[10px] font-bold text-accent whitespace-nowrap">
                            {(aiTokensUsed || 0).toLocaleString('ru-RU')}
                        </span>
                    </div>
                    {isSearching ? (
                        <div className="flex items-center bg-black/40 border border-border rounded-full px-3 py-1 flex-1 sm:flex-none w-full sm:w-48 animate-fade-in">
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
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-text-secondary hover:text-warning bg-white/5 border border-white/5 hover:border-warning/30"
                        title="Очистить системные логи"
                    >
                        <Trash2 size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden xs:inline">Логи</span>
                    </button>
                    <button
                        onClick={() => setShowConfirmChat(true)}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-text-secondary hover:text-danger bg-white/5 border border-white/5 hover:border-danger/30"
                        title="Очистить весь чат"
                    >
                        <Eraser size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden xs:inline">Чат</span>
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

                {chatMsgs.map((item, i) => {
                    const msg = item.msg;
                    const prevItem = chatMsgs[i - 1];
                    const prevMsg = prevItem ? prevItem.msg : null;
                    const showDateSeparator = !searchQuery && (!prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString());

                    return (
                        <div key={item.globalIndex} id={`chat-msg-${item.globalIndex}`} className="flex flex-col rounded-2xl">
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
                                            <div className={`p-3 rounded-2xl text-sm shadow-sm break-words overflow-hidden relative ${msg.role === 'user'
                                                ? 'bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-none'
                                                : 'bg-accent/10 border border-accent/20 text-text-primary rounded-tl-none markdown-content'
                                                }`}>
                                                {searchQuery && (
                                                    <button
                                                        onClick={() => handleJumpToMessage(item.globalIndex)}
                                                        className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-accent rounded-full text-white transition-colors z-10"
                                                        title="Перейти к сообщению"
                                                    >
                                                        <Search size={12} />
                                                    </button>
                                                )}
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

                {/* Typing indicator */}
                {isThinking && (
                    <div className="flex items-center gap-3 px-4 py-3 animate-fade-in">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center shrink-0">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div className="bg-bg-secondary/80 border border-border rounded-2xl px-4 py-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            <span className="text-xs text-text-secondary ml-2">Nova печатает...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-2 md:p-4 border-t border-border bg-[#0d0d12] relative z-10 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] md:pb-4 pb-safe">

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

                <form onSubmit={handleSend} className="relative flex items-end bg-[#13131a] border border-border/70 rounded-2xl pl-1 pr-[50px] md:pl-2 md:pr-14 md:py-1 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 transition-all shadow-inner">

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
                        className="p-3 md:p-2.5 mb-0.5 text-text-secondary hover:text-white transition-colors rounded-full shrink-0"
                        title="Прикрепить файл или фото"
                    >
                        <Paperclip size={20} />
                    </button>

                    <textarea
                        placeholder={attachments.length > 0 ? "Добавить описание..." : "Написать Nova..."}
                        className="w-full bg-transparent border-none pl-1 pr-1 py-3.5 md:py-3 text-[15px] md:text-sm outline-none text-white placeholder:text-text-secondary resize-none custom-scrollbar leading-snug"
                        value={useStore(state => state.tourDemoAIText) || input}
                        onChange={(e) => setInput(e.target.value)}
                        readOnly={!!useStore(state => state.tourDemoAIText)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            } else if (e.key.length === 1) {
                                playKeyClick();
                            }
                        }}
                        rows={1}
                        style={{ maxHeight: '120px', minHeight: '48px', height: 'auto', overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
                        ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; } }}
                    />
                    <button
                        type="submit"
                        disabled={(!input.trim() && attachments.length === 0) || isTyping}
                        className="absolute right-1.5 md:right-2 bottom-1.5 md:bottom-2 p-2 rounded-xl border border-white/5 bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex justify-center items-center h-10 w-10 md:h-9 md:w-9 shadow-[0_5px_15px_rgba(109,40,217,0.3)] disabled:shadow-none"
                    >
                        <Send size={18} className="-ml-0.5" />
                    </button>
                </form>
            </div>

            {/* Profile Edit Modal */}
            {profileEditModal.isOpen && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-xl">
                    <div className="bg-bg-secondary border border-border p-5 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in text-center">
                        <h3 className="font-bold text-lg mb-2 text-white">Обновление профиля</h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Nova предлагает обновить поле <strong>{profileEditModal.field}</strong>.
                        </p>
                        <div className="mb-4 text-left text-sm max-h-32 overflow-y-auto custom-scrollbar">
                            <p className="text-text-secondary line-through mb-1 break-words">{profileEditModal.oldValue}</p>
                            <p className="text-white bg-white/10 p-2 rounded-lg break-words">{profileEditModal.newValue}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setProfileEditModal({ isOpen: false, field: '', newValue: '', oldValue: '' })}
                                className="flex-1 py-2 rounded-lg bg-black/40 hover:bg-black/60 text-text-secondary transition-colors text-sm font-medium"
                            >
                                Оставить старое
                            </button>
                            <button
                                onClick={() => {
                                    useStore.getState().updateUserProfile({ [profileEditModal.field]: profileEditModal.newValue });
                                    setProfileEditModal({ isOpen: false, field: '', newValue: '', oldValue: '' });
                                    addToast('Профиль успешно обновлен!', 'success');
                                }}
                                className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors text-sm font-bold shadow-lg shadow-accent/20"
                            >
                                Обновить
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {showProfileWizard && (
                <ProfileWizardModal onClose={() => setShowProfileWizard(false)} />
            )}
        </div>
    );
}
