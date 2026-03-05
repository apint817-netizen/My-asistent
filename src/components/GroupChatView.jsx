import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, Users, Shield, UserPlus, Settings, LogOut, CheckCheck, Check, Search, Trash2, X } from 'lucide-react';

export default function GroupChatView({ group, user, onBack, onGroupUpdate }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'members'

    const [members, setMembers] = useState([]);
    const [profiles, setProfiles] = useState({}); // id -> profile

    // search for inviting
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const myRole = members.find(m => m.user_id === user.id)?.role || 'member';
    const canManage = myRole === 'owner' || myRole === 'admin';

    useEffect(() => {
        loadMessages();
        loadMembers();

        const msgsChannel = supabase.channel(`group_chat_${group.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'group_messages',
                filter: `group_id=eq.${group.id}`
            }, payload => {
                const msg = payload.new;
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    const withoutOptimistic = prev.filter(m => !(m._optimistic && m.content === msg.content && m.sender_id === msg.sender_id));
                    return [...withoutOptimistic, msg];
                });
            })
            .subscribe();

        const membersChannel = supabase.channel(`group_members_${group.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_members',
                filter: `group_id=eq.${group.id}`
            }, () => {
                loadMembers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(msgsChannel);
            supabase.removeChannel(membersChannel);
        };
    }, [group.id]);

    useEffect(() => {
        if (activeTab === 'chat') {
            scrollToBottom();
        }
    }, [messages, activeTab]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    const loadMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('group_messages')
                .select('*')
                .eq('group_id', group.id)
                .order('created_at', { ascending: true })
                .limit(200);

            if (error) throw error;
            setMessages(data || []);

            // Загружаем профили отправителей
            if (data?.length > 0) {
                const senderIds = [...new Set(data.map(m => m.sender_id))];
                loadProfiles(senderIds);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('group_members')
                .select('*')
                .eq('group_id', group.id);
            if (error) throw error;
            setMembers(data || []);
            if (data?.length > 0) {
                loadProfiles(data.map(m => m.user_id));
            }
        } catch (error) {
            console.error('Error loading members:', error);
        }
    };

    const loadProfiles = async (userIds) => {
        const missingIds = userIds.filter(id => !profiles[id]);
        if (missingIds.length === 0) return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, user_tag')
                .in('id', missingIds);
            if (error) throw error;

            setProfiles(prev => {
                const newProfiles = { ...prev };
                data.forEach(p => newProfiles[p.id] = p);
                return newProfiles;
            });
        } catch (error) {
            console.error('Error loading profiles:', error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text) return;

        const optimisticMsg = {
            id: 'opt_' + Date.now(),
            group_id: group.id,
            sender_id: user.id,
            content: text,
            created_at: new Date().toISOString(),
            _optimistic: true
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');

        try {
            const { error } = await supabase
                .from('group_messages')
                .insert({
                    group_id: group.id,
                    sender_id: user.id,
                    content: text
                });
            if (error) throw error;
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setNewMessage(text);
        }
    };

    // Поиск пользователей для добавления
    useEffect(() => {
        const searchUsers = async () => {
            if (!searchQuery.trim() || searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // Поиск по display_name и email
                // В идеале использовать RPC, но сделаем простой ilike по display_name для теста
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, display_name, user_tag, avatar_url')
                    .ilike('display_name', `%${searchQuery}%`)
                    .neq('id', user.id)
                    .limit(10);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, user.id]);

    const handleAddMember = async (targetUserId) => {
        try {
            const { error } = await supabase
                .from('group_members')
                .insert({
                    group_id: group.id,
                    user_id: targetUserId,
                    role: 'member'
                });
            if (error) {
                if (error.code === '23505') alert('Пользователь уже в команде');
                else throw error;
            } else {
                setSearchQuery('');
                loadMembers();
            }
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Ошибка при добавлении');
        }
    };

    const handleRemoveMember = async (targetUserId) => {
        if (!confirm('Вы уверены?')) return;
        try {
            const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', group.id)
                .eq('user_id', targetUserId);
            if (error) throw error;
            if (targetUserId === user.id) {
                onBack(); // Я вышел
                onGroupUpdate();
            } else {
                loadMembers();
            }
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    const handleChangeRole = async (targetUserId, newRole) => {
        if (!confirm(`Изменить роль на ${newRole}?`)) return;
        try {
            const { error } = await supabase
                .from('group_members')
                .update({ role: newRole })
                .eq('group_id', group.id)
                .eq('user_id', targetUserId);
            if (error) throw error;
            loadMembers();
        } catch (error) {
            console.error('Error changing role:', error);
            alert('Ошибка. Возможно, у вас нет прав на это действие.');
        }
    };

    const formatTime = (dateStr) => {
        try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
    };

    return (
        <div className="flex flex-col bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade-in relative z-10 w-full max-w-5xl mx-auto" style={{ minHeight: '75vh', maxHeight: '85vh' }}>
            {/* Header */}
            <header className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                            {group.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base leading-tight">{group.name}</h3>
                            <p className="text-xs text-text-secondary mt-0.5">{members.length} участников · Роль: {myRole}</p>
                        </div>
                    </div>
                </div>

                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'chat' ? 'bg-white/10 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                    >
                        Чат
                    </button>
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'members' ? 'bg-white/10 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                    >
                        Участники
                    </button>
                </div>
            </header>

            {/* Chat Tab */}
            {activeTab === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide flex flex-col gap-3" style={{ minHeight: '300px' }}>
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                                <Shield size={48} className="text-white/50 mb-4" />
                                <p className="text-sm font-semibold text-white/70">Чат команды пуст</p>
                                <p className="text-xs text-text-secondary mt-1">Организуйте работу вместе!</p>
                            </div>
                        ) : (
                            messages.map((msg, i) => {
                                const isMine = msg.sender_id === user?.id;
                                const prevMsg = messages[i - 1];
                                const showAvatar = !isMine && (i === 0 || prevMsg?.sender_id !== msg.sender_id);
                                const isOptimistic = msg._optimistic;
                                const senderProfile = profiles[msg.sender_id];

                                return (
                                    <div key={msg.id} className={`flex max-w-[80%] md:max-w-[70%] ${isMine ? 'self-end' : 'self-start'} gap-2 ${isOptimistic ? 'opacity-70' : ''} animate-fade-in`}>
                                        {!isMine && (
                                            <div className="w-8 shrink-0 flex items-end">
                                                {showAvatar && (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shadow-md">
                                                        {senderProfile?.avatar_url ? (
                                                            <img src={senderProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            senderProfile?.display_name?.charAt(0)?.toUpperCase() || 'U'
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                            {!isMine && showAvatar && (
                                                <span className="text-xs text-text-secondary ml-2 mb-1 font-medium">{senderProfile?.display_name || '...'}</span>
                                            )}
                                            <div className={`px-4 py-2.5 ${isMine
                                                ? 'bg-accent text-white rounded-2xl rounded-br-md shadow-accent/20 shadow-lg'
                                                : 'bg-white/[0.08] text-white rounded-2xl rounded-bl-md shadow-md/50'
                                                } relative`}>
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                                <div className="flex items-center justify-end gap-1 mt-1">
                                                    <span className="text-[9px] opacity-50 font-medium">{formatTime(msg.created_at)}</span>
                                                    {isMine && (
                                                        isOptimistic ? (
                                                            <div className="w-2.5 h-2.5 border border-white/40 border-t-transparent rounded-full animate-spin ml-0.5"></div>
                                                        ) : (
                                                            msg.id && <Check size={12} className="opacity-50 ml-0.5" />
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 sm:p-4 border-t border-white/5 bg-white/[0.02] shrink-0">
                        <form onSubmit={sendMessage} className="relative flex items-center gap-2 max-w-4xl mx-auto">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Написать в команду..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-2xl pl-4 pr-14 py-3 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-accent text-white rounded-xl hover:bg-accent/80 disabled:opacity-30 transition-all active:scale-90"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8 bg-black/20">
                    {/* Список участников */}
                    <div className="flex-1">
                        <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Users size={18} className="text-accent" /> Участники ({members.length})</h4>
                        <div className="space-y-2">
                            {members.map(m => {
                                const profile = profiles[m.user_id];
                                const isMe = m.user_id === user.id;
                                return (
                                    <div key={m.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden shadow-inner">
                                                {profile?.avatar_url ? (
                                                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    profile?.display_name?.charAt(0)?.toUpperCase() || 'U'
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium text-base flex items-center gap-2">
                                                    {profile?.display_name || 'Загрузка...'}
                                                    {isMe && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">ВЫ</span>}
                                                </div>
                                                <div className={`text-[11px] mt-1 font-bold px-2 py-0.5 rounded-full inline-block uppercase tracking-wider ${m.role === 'owner' ? 'bg-warning/20 text-warning' :
                                                        m.role === 'admin' ? 'bg-success/20 text-success' :
                                                            'bg-white/10 text-text-secondary'
                                                    }`}>
                                                    {m.role === 'owner' ? 'Создатель' : m.role === 'admin' ? 'Администратор' : 'Участник'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Действия для админов/owner */}
                                            {myRole === 'owner' && !isMe && (
                                                <div className="relative">
                                                    <select
                                                        value={m.role}
                                                        onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                                                        className="bg-black/60 border border-white/10 text-white text-xs font-semibold rounded-xl pl-3 pr-8 py-2 outline-none appearance-none hover:border-white/20 transition-colors cursor-pointer"
                                                    >
                                                        <option value="member">Участник</option>
                                                        <option value="admin">Администратор</option>
                                                    </select>
                                                    <Settings size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                                                </div>
                                            )}

                                            {(canManage && !isMe && m.role !== 'owner') && (
                                                <button onClick={() => handleRemoveMember(m.user_id)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors" title="Исключить">
                                                    <X size={16} />
                                                </button>
                                            )}

                                            {isMe && m.role !== 'owner' && (
                                                <button onClick={() => handleRemoveMember(m.user_id)} className="px-4 py-2 rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white text-xs font-bold transition-colors flex items-center gap-2">
                                                    <LogOut size={14} /> Выйти из команды
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Приглашение новых (только для админов/оунеров) */}
                    {canManage && (
                        <div className="lg:w-80 shrink-0">
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 sticky top-0 shadow-lg">
                                <h4 className="text-white font-bold mb-4 flex items-center gap-2"><UserPlus size={18} className="text-accent" /> Пригласить</h4>

                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Поиск по имени..."
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
                                        />
                                    </div>

                                    <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide py-2">
                                        {isSearching ? (
                                            <div className="text-center py-6 text-sm font-medium text-text-secondary flex flex-col items-center justify-center gap-3">
                                                <div className="w-6 h-6 border-2 border-accent border-top-transparent rounded-full animate-spin" /> Поиск...
                                            </div>
                                        ) : searchQuery.length > 0 && searchResults.length === 0 ? (
                                            <div className="text-center py-6 text-sm font-medium text-text-secondary bg-white/5 rounded-xl border border-white/5">Ничего не найдено</div>
                                        ) : (
                                            searchResults.map(userResult => {
                                                const isAlreadyMember = members.some(m => m.user_id === userResult.id);
                                                return (
                                                    <div key={userResult.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all outline outline-1 outline-transparent hover:outline-white/10 group cursor-default">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-500/50 flex shrink-0 items-center justify-center text-white text-sm font-bold overflow-hidden shadow-inner">
                                                                {userResult.avatar_url ? (
                                                                    <img src={userResult.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    userResult.display_name?.charAt(0)?.toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-accent transition-colors">{userResult.display_name}</p>
                                                                {userResult.user_tag && <p className="text-[10px] text-text-secondary truncate mt-0.5">#{userResult.user_tag}</p>}
                                                            </div>
                                                        </div>
                                                        <button
                                                            disabled={isAlreadyMember}
                                                            onClick={() => handleAddMember(userResult.id)}
                                                            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-accent/20 text-accent hover:bg-accent hover:text-white disabled:opacity-30 disabled:hover:bg-accent/20 disabled:hover:text-accent transition-all active:scale-95 ml-2"
                                                        >
                                                            {isAlreadyMember ? <Check size={16} /> : <Plus size={16} />}
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
