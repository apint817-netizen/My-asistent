import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, User } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ChatView({ friend, onBack }) {
    const user = useStore(state => state.user);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!user || !friend) return;

        loadMessages();

        // Subscribe to real-time messages between these two users
        const channel = supabase.channel(`chat_${user.id}_${friend.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `or(and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id}))`
            }, payload => {
                setMessages(prev => [...prev, payload.new]);
                scrollToBottom();
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
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;
            setMessages(data || []);

            // Mark messages as read
            const unreadIds = data.filter(m => m.receiver_id === user.id && !m.is_read).map(m => m.id);
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

        setNewMessage(''); // optimistic clear

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: friend.id,
                    content: text
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error sending message:', error);
            setNewMessage(text); // reset on error
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade-in relative z-10 w-full max-w-4xl mx-auto">
            {/* Header */}
            <header className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden border border-white/10 shadow-lg">
                                {friend.avatar_url ? (
                                    <img src={friend.avatar_url} alt={friend.display_name} className="w-full h-full object-cover" />
                                ) : (
                                    friend.display_name?.charAt(0)?.toUpperCase() || 'U'
                                )}
                            </div>
                            {friend.is_online && (
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success border-2 border-[#16161a] rounded-full"></div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white flex items-center gap-2">
                                {friend.display_name}
                            </h3>
                            <p className="text-xs text-text-secondary">
                                {friend.is_online ? 'В сети' : 'Не в сети'} · Lv. {friend.level}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-4 flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-accent border-t-white rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                            <User size={24} className="text-white" />
                        </div>
                        <p className="text-sm font-medium">Начните диалог с {friend.display_name}</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMine = msg.sender_id === user.id;
                        const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id;

                        return (
                            <div key={msg.id} className={`flex max-w-[80%] ${isMine ? 'self-end flex-row-reverse' : 'self-start'} gap-3`}>
                                {!isMine && (
                                    <div className="w-8 shrink-0 flex items-end">
                                        {showAvatar && (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                                {friend.avatar_url ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" /> : friend.display_name?.charAt(0)?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className={`px-4 py-2.5 rounded-2xl ${isMine ? 'bg-accent text-white rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm'} shadow-md relative group`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    <span className="text-[9px] opacity-50 mt-1 block text-right font-medium">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isMine && msg.is_read && <Check size={10} className="inline ml-1" />}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                <form onSubmit={sendMessage} className="relative flex items-center gap-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Написать сообщение..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl pl-4 pr-12 py-3.5 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent transition-colors"
                    >
                        <Send size={16} className={newMessage.trim() ? "translate-x-[1px]" : ""} />
                    </button>
                </form>
            </div>
        </div>
    );
}
