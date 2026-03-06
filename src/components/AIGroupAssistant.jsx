import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';
import { Send, Bot, User, Trash2, Paperclip } from 'lucide-react';
import { callAI, GOOGLE_OPENAI_BASE } from '../utils/geminiApi';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';

export default function AIGroupAssistant({ group, user, members, profiles, tasks }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    const apiKey = useStore(state => state.apiKey);
    const googleModel = useStore(state => state.googleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const userProfile = useStore(state => state.userProfile) || {};

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
        scrollToBottom();
    }, [messages, isThinking]);

    const generateAIResponse = async (userMessage) => {
        try {
            const groupContext = `Группа: "${group.name}".
Участники: ${members.map(m => profiles[m.user_id]?.display_name || 'Неизвестный').join(', ')}.
Активные задачи: ${tasks.filter(t => !t.completed).map(t => `- ${t.title} (${t.reward_amount} ${t.reward_type})`).join('\n') || 'Нет активных задач'}.`;

            const systemInstruction = `Ты Nova — ИИ-ассистент командира/руководителя в приложении. Твоя задача — помогать управлять группой "${group.name}". Отвечай ТОЛЬКО по-русски, лаконично, с эмпатией и пользой.
Твои возможности:
1. Консультирование руководителя по мотивации команды, распределению задач и контролю.
2. Создание задач ДЛЯ ГРУППЫ по запросу.

ЧТОБЫ СОЗДАТЬ ЗАДАЧУ ДЛЯ ГРУППЫ:
Если руководитель просит создать задачу (например "пусть кто-то обзвонит клиентов", "создай задачу на уборку"):
Шаг 1. ОБЯЗАТЕЛЬНО задай уточняющие вопросы, если информации недостаточно:
- Для кого именно эта задача (или кто угодно из команды может взять)?
- Какая награда за задачу (деньги, очки, или это просто рутинная обязанность без награды)?
- Насколько задача срочная или важная?

Шаг 2. ТОЛЬКО когда руководитель даст все нужные подробности (или если он сразу написал всё в первом сообщении), в конце своего ответа добавь специальную команду (в квадратных скобках):
[ADD_GROUP_TASK: Название задачи | Подробное описание | points/money/duty | 100 | normal/important/urgent/urgent_important]

Например:
Конечно, я добавила эту задачу для команды!
[ADD_GROUP_TASK: Обзвон холодной базы | Нужно обзвонить 50 клиентов из нового списка | points | 150 | urgent_important]

Логика наград:
- "money" и сумма (если поощрение деньгами)
- "duty" и 0 (если это обычная обязанность)
- "points" и от 10 до 500 (стандартная геймификация)

Текущий контекст группы:
${groupContext}
`;

            const baseUrl = aiProvider === 'google' ? GOOGLE_OPENAI_BASE : proxyParams?.url;
            const modelToUse = aiProvider === 'google' ? googleModel : proxyParams?.model;
            let finalKey = apiKey;
            if (aiProvider === 'custom') finalKey = proxyParams?.key || apiKey;

            // Формируем историю для API
            const history = messages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }));

            const responseText = await callAI({
                baseUrl,
                apiKey: finalKey,
                model: modelToUse,
                systemPrompt: systemInstruction,
                history,
                userMessage,
                maxTokens: 800
            });

            let cleanResponse = responseText;

            // Обработка команд создания задач
            const addGroupTaskRegex = /\[ADD_GROUP_TASK:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(points|money|duty)\s*\|\s*(\d+)\s*\|\s*(normal|important|urgent|urgent_important)\]/g;
            let match;
            let tasksAdded = 0;

            while ((match = addGroupTaskRegex.exec(responseText)) !== null) {
                const title = match[1].trim();
                const desc = match[2].trim();
                const rewardType = match[3];
                const amount = parseInt(match[4], 10);
                const category = match[5];

                try {
                    const { error } = await supabase.from('group_tasks').insert({
                        group_id: group.id,
                        title,
                        description: desc,
                        reward_type: rewardType,
                        reward_amount: amount,
                        value: amount, // Для обратной совместимости
                        category,
                        created_by: user.id
                    });
                    if (error) throw error;
                    tasksAdded++;
                } catch (err) {
                    console.error('Error auto-creating task:', err);
                }
            }

            cleanResponse = cleanResponse.replace(addGroupTaskRegex, '').trim();

            if (tasksAdded > 0) {
                cleanResponse += `\n\n*(✅ Добавлено ${tasksAdded} задач(и) в список команды)*`;
            }

            setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);

        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка при обращении к ИИ: ${error.message}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsThinking(true);

        await generateAIResponse(userMsg);
    };

    const clearChat = () => {
        if (window.confirm('Очистить историю диалога с ИИ?')) {
            setMessages([]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-bg-primary absolute inset-0 z-10 pt-4">
            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto w-full px-4 sm:px-6 scrollbar-hide"
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-60">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                            <Bot size={32} className="text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Ассистент Nova Командир</h3>
                        <p className="text-sm text-text-secondary text-center max-w-sm">
                            Я здесь, чтобы помочь вам управлять командой. Скажите, какую задачу нужно поставить участникам, и я всё оформлю!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 pb-6">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex max-w-[85%] ${msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
                                <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${msg.role === 'user'
                                        ? 'bg-accent/20 border-accent/30 text-accent'
                                        : 'bg-purple-500/20 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                                        }`}>
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-accent text-white rounded-tr-sm shadow-sm'
                                        : 'bg-white/5 border border-white/10 text-white rounded-tl-sm shadow-sm'
                                        }`}>
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            {msg.role === 'user' ? (
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            ) : (
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex max-w-[85%] mr-auto justify-start">
                                <div className="flex gap-3 flex-row">
                                    <div className="shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                                        <Bot size={16} className="text-purple-400 animate-pulse" />
                                    </div>
                                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-text-secondary rounded-tl-sm flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 sm:p-6 pb-6 bg-gradient-to-t from-bg-primary via-bg-primary to-transparent z-10 w-full relative shrink-0 border-t border-white/5">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] text-purple-400/70 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Bot size={10} /> Умное создание задач
                    </span>
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="text-[10px] text-text-secondary hover:text-danger flex items-center gap-1 transition-colors">
                            <Trash2 size={10} /> Очистить чат
                        </button>
                    )}
                </div>
                <form onSubmit={handleSend} className="relative group">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                        placeholder="Например: Поручи участникам провести генеральную уборку..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl pl-4 pr-[3.5rem] py-4 text-sm text-white focus:border-purple-500/50 outline-none resize-none overflow-hidden transition-all min-h-[56px] focus:bg-black/60 shadow-inner group-hover:border-white/20"
                        rows={1}
                        style={{ height: 'min(auto, 150px)' }}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isThinking}
                        className="absolute right-2.5 bottom-2.5 w-auto px-4 h-9 flex items-center justify-center rounded-xl bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 disabled:hover:bg-purple-500 transition-all active:scale-95 shadow-lg shadow-purple-500/20"
                    >
                        <Send size={15} className={input.trim() && !isThinking ? 'ml-0.5' : ''} />
                    </button>
                </form>
            </div>
        </div>
    );
}
