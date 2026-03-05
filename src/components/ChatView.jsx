import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, User, Check, CheckCheck } from 'lucide-react';

export default function ChatView({ friend, onBack }) {
    const [user, setUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Получаем пользователя из Supabase Auth
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
            }
        });
    }, []);

    useEffect(() => {
        if (!user || !friend) return;

        loadMessages();

        // Subscribe to real-time messages
        const channel = supabase.channel(`chat_${[user.id, friend.id].sort().join('_')}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, payload => {
                const msg = payload.new;
                // Только сообщения между нами
                const isOurs = (msg.sender_id === user.id && msg.receiver_id === friend.id) ||
                    (msg.sender_id === friend.id && msg.receiver_id === user.id);
                if (isOurs) {
                    setMessages(prev => {
                        // Не добавляем дубликат (если уже есть через оптимистичный рендер)
                        if (prev.some(m => m.id === msg.id)) return prev;
                        // Заменяем оптимистичное сообщение реальным
                        const withoutOptimistic = prev.filter(m => !(m._optimistic && m.content === msg.content && m.sender_id === msg.sender_id));
                        return [...withoutOptimistic, msg];
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, friend]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    const loadMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;
            setMessages(data || []);

            // Mark messages as read
            const unreadIds = (data || []).filter(m => m.receiver_id === user.id && !m.is_read).map(m => m.id);
            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !user || !friend) return;

        // Оптимистичный рендер — показываем сообщение мгновенно
        const optimisticMsg = {
            id: 'optimistic_' + Date.now(),
            sender_id: user.id,
            receiver_id: friend.id,
            content: text,
            created_at: new Date().toISOString(),
            is_read: false,
            _optimistic: true
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: friend.id,
                    content: text
                });

            if (error) {
                // Убираем оптимистичное при ошибке
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                setNewMessage(text);
                console.error('Error sending message:', error);
            }
        } catch (error) {
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setNewMessage(text);
            console.error('Error sending message:', error);
        }
    };

    const formatTime = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const formatDateSeparator = (dateStr) => {
        try {
            const d = new Date(dateStr);
            const today = new Date();
            if (d.toDateString() === today.toDateString()) return 'Сегодня';
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        } catch {
            return '';
        }
    };

    return (
        <div className="flex flex-col bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade-in relative z-10 w-full max-w-4xl mx-auto" style={{ minHeight: '70vh', maxHeight: '85vh' }}>
            {/* Header */}
            <header className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-4 shrink-0">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-all active:scale-95"
                >
                    <ArrowLeft size={18} />
                </button>

                <div className="flex items-center gap-3 flex-1">
                    <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden border-2 border-white/10 shadow-lg">
                            {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.display_name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg">{friend.display_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        {friend.is_online && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-[#0a0a0c] rounded-full"></div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base leading-tight">{friend.display_name}</h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                            {friend.is_online ? (
                                <span className="text-success">В сети</span>
                            ) : (
                                'Не в сети'
                            )}
                            {' · Lv. '}{friend.level || 1}
                        </p>
                    </div>
                </div>
            </header>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide flex flex-col gap-2" style={{ minHeight: '300px' }}>
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                            <User size={32} className="text-white/50" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white/70">Начните диалог</p>
                            <p className="text-xs text-text-secondary mt-1">Напишите первое сообщение для {friend.display_name}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, i) => {
                            const isMine = msg.sender_id === user?.id;
                            const prevMsg = messages[i - 1];
                            const showAvatar = !isMine && (i === 0 || prevMsg?.sender_id !== msg.sender_id);
                            const isOptimistic = msg._optimistic;

                            // Date separator
                            let dateSep = null;
                            if (i === 0 || new Date(msg.created_at).toDateString() !== new Date(prevMsg?.created_at).toDateString()) {
                                dateSep = (
                                    <div key={`date_${i}`} className="flex items-center justify-center my-4">
                                        <span className="text-[10px] font-semibold text-text-secondary bg-white/5 px-3 py-1 rounded-full backdrop-blur-sm">
                                            {formatDateSeparator(msg.created_at)}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <React.Fragment key={msg.id}>
                                    {dateSep}
                                    <div className={`flex max-w-[75%] ${isMine ? 'self-end' : 'self-start'} gap-2 ${isOptimistic ? 'opacity-70' : ''} animate-fade-in`}>
                                        {!isMine && (
                                            <div className="w-7 shrink-0 flex items-end">
                                                {showAvatar && (
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shadow-md">
                                                        {friend.avatar_url ? (
                                                            <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            friend.display_name?.charAt(0)?.toUpperCase()
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className={`px-4 py-2.5 ${isMine
                                            ? 'bg-accent text-white rounded-2xl rounded-br-md shadow-accent/20 shadow-lg'
                                            : 'bg-white/[0.08] text-white rounded-2xl rounded-bl-md shadow-md'
                                            } relative`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                            <div className="flex items-center justify-end gap-1 mt-1">
                                                <span className="text-[9px] opacity-50 font-medium">
                                                    {formatTime(msg.created_at)}
                                                </span>
                                                {isMine && (
                                                    isOptimistic ? (
                                                        <div className="w-2.5 h-2.5 border border-white/40 border-t-transparent rounded-full animate-spin ml-0.5"></div>
                                                    ) : msg.is_read ? (
                                                        <CheckCheck size={12} className="text-blue-300 ml-0.5" />
                                                    ) : (
                                                        <Check size={12} className="opacity-50 ml-0.5" />
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-3 sm:p-4 border-t border-white/5 bg-white/[0.02] shrink-0">
                <form onSubmit={sendMessage} className="relative flex items-center gap-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Написать сообщение..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl pl-4 pr-14 py-3 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-accent text-white rounded-xl hover:bg-accent/80 disabled:opacity-30 disabled:hover:bg-accent transition-all active:scale-90"
                    >
                        <Send size={16} className={newMessage.trim() ? "translate-x-[1px]" : ""} />
                    </button>
                </form>
            </div>
        </div>
    );
}
