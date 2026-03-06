import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { ArrowLeft, Send, Users, Shield, UserPlus, Settings, LogOut, CheckCheck, Check, Search, Trash2, X, ListTodo, Plus, Circle, CheckCircle, Sparkles, Bot, Edit2, MessageSquare } from 'lucide-react';
import AIGroupAssistant from './AIGroupAssistant';

export default function GroupChatView({ group, user, onBack, onGroupUpdate }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    // Modals & Panels state
    const [showChat, setShowChat] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Edit group state
    const [editGroupName, setEditGroupName] = useState(group.name);
    const [editGroupDesc, setEditGroupDesc] = useState(group.description || '');

    const { addTokens } = useStore();

    const [members, setMembers] = useState([]);
    const [profiles, setProfiles] = useState({}); // id -> profile
    const [tasks, setTasks] = useState([]);

    // Tasks form state
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskValue, setNewTaskValue] = useState(10);
    const [newTaskRewardType, setNewTaskRewardType] = useState('points');
    const [newTaskCategory, setNewTaskCategory] = useState('normal');
    const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');



    // Edit task state
    const [editingTaskId, setEditingTaskId] = useState(null);

    // Avatar viewer state
    const [viewingAvatar, setViewingAvatar] = useState(null);

    // Global settings for AI
    const googleModel = useStore(state => state.googleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const apiKey = useStore(state => state.apiKey);

    // search & invite
    const [friends, setFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const myRole = members.find(m => m.user_id === user.id)?.role || 'member';
    const canManage = myRole === 'owner' || myRole === 'admin';

    useEffect(() => {
        loadMessages();
        loadMembers();
        loadFriends();
        loadTasks();

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

        const tasksChannel = supabase.channel(`group_tasks_${group.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_tasks',
                filter: `group_id=eq.${group.id}`
            }, () => {
                loadTasks();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(msgsChannel);
            supabase.removeChannel(membersChannel);
            supabase.removeChannel(tasksChannel);
        };
    }, [group.id]);

    useEffect(() => {
        if (showChat) {
            scrollToBottom();
        }
    }, [messages, showChat]);

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

    const loadTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('group_tasks')
                .select('*')
                .eq('group_id', group.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTasks(data || []);
            if (data?.length > 0) {
                const userIds = [];
                data.forEach(t => {
                    if (t.created_by) userIds.push(t.created_by);
                    if (t.completed_by) userIds.push(t.completed_by);
                    if (t.assigned_to) userIds.push(t.assigned_to);
                });
                if (userIds.length > 0) loadProfiles([...new Set(userIds)]);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
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

    const loadFriends = async () => {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    status, user_id, friend_id,
                    profile_user:profiles!friendships_user_id_fkey(id, display_name, avatar_url, user_tag),
                    profile_friend:profiles!friendships_friend_id_fkey(id, display_name, avatar_url, user_tag)
                `)
                .eq('status', 'accepted')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            if (error) throw error;
            const formattedFriends = data.map(rel => {
                const isInitiator = rel.user_id === user.id;
                return isInitiator ? rel.profile_friend : rel.profile_user;
            }).filter(f => f && f.id);

            setFriends(formattedFriends);
        } catch (err) {
            console.error('Error loading friends:', err);
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
                let queryBuilder = supabase
                    .from('profiles')
                    .select('id, display_name, user_tag, avatar_url')
                    .neq('id', user.id)
                    .limit(10);

                let q = searchQuery.trim();
                if (q.includes('@')) {
                    queryBuilder = queryBuilder.eq('email', q);
                } else if (q.includes('#')) {
                    const parts = q.split('#');
                    if (parts.length === 2 && parts[0] && parts[1]) {
                        queryBuilder = queryBuilder.ilike('display_name', `%${parts[0]}%`).eq('user_tag', parts[1]);
                    } else if (parts[1]) {
                        queryBuilder = queryBuilder.eq('user_tag', parts[1]);
                    }
                } else {
                    if (/^\d{4}$/.test(q)) {
                        queryBuilder = queryBuilder.or(`display_name.ilike.%${q}%,user_tag.eq.${q}`);
                    } else {
                        queryBuilder = queryBuilder.ilike('display_name', `%${q}%`);
                    }
                }

                const { data, error } = await queryBuilder;
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

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            if (editingTaskId) {
                const { error } = await supabase
                    .from('group_tasks')
                    .update({
                        title: newTaskTitle.trim(),
                        description: newTaskDesc.trim(),
                        value: newTaskValue,
                        reward_amount: newTaskValue,
                        reward_type: newTaskRewardType,
                        category: newTaskCategory,
                        assigned_to: newTaskAssignedTo || null
                    })
                    .eq('id', editingTaskId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('group_tasks')
                    .insert({
                        group_id: group.id,
                        title: newTaskTitle.trim(),
                        description: newTaskDesc.trim(),
                        value: newTaskValue,
                        reward_amount: newTaskValue,
                        reward_type: newTaskRewardType,
                        category: newTaskCategory,
                        assigned_to: newTaskAssignedTo || null,
                        created_by: user.id
                    });
                if (error) throw error;
            }

            setNewTaskTitle('');
            setNewTaskDesc('');
            setNewTaskValue(10);
            setNewTaskRewardType('points');
            setNewTaskCategory('normal');
            setNewTaskAssignedTo('');
            setShowTaskForm(false);
            setEditingTaskId(null);
            loadTasks();
        } catch (err) {
            console.error('Error saving task:', err);
            alert('Ошибка при сохранении задачи');
        }
    };

    const handleEditTask = (task) => {
        setEditingTaskId(task.id);
        setNewTaskTitle(task.title);
        setNewTaskDesc(task.description || '');
        setNewTaskValue(task.value);
        setNewTaskRewardType(task.reward_type || 'points');
        setNewTaskCategory(task.category || 'normal');
        setNewTaskAssignedTo(task.assigned_to || '');
        setShowTaskForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleToggleTask = async (task) => {
        if (!canManage && task.assigned_to && task.assigned_to !== user.id) {
            alert('Эту задачу может выполнить только назначенный исполнитель или админ.');
            return;
        }

        try {
            const isCompleted = !task.completed;
            const updates = {
                completed: isCompleted,
                completed_by: isCompleted ? user.id : null,
                completed_at: isCompleted ? new Date().toISOString() : null
            };
            const { error } = await supabase
                .from('group_tasks')
                .update(updates)
                .eq('id', task.id);
            if (error) throw error;

            // Optimistic update
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));

            // Начисление очков (только если мы её выполнили, а не отменили)
            if (isCompleted && task.value) {
                addTokens(task.value, `Командная задача: ${task.title}`);
            }
        } catch (err) {
            console.error('Error toggling task:', err);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!confirm('Удалить задачу?')) return;
        try {
            const { error } = await supabase
                .from('group_tasks')
                .delete()
                .eq('id', taskId);
            if (error) throw error;
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err) {
            console.error('Error deleting task:', err);
            alert('Ошибка удаления. Возможно у вас нет прав.');
        }
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('groups').update({
                name: editGroupName.trim(),
                description: editGroupDesc.trim()
            }).eq('id', group.id);
            if (error) throw error;
            setShowSettings(false);
            onGroupUpdate();
        } catch (err) {
            console.error('Update error:', err);
            alert('Ошибка при обновлении команды');
        }
    };

    const handleDeleteGroup = async () => {
        const confirmName = prompt('Чтобы удалить команду, введите её точное название:');
        if (confirmName !== group.name) {
            if (confirmName !== null) alert('Название не совпадает. Отмена.');
            return;
        }
        try {
            const { error } = await supabase.from('groups').delete().eq('id', group.id);
            if (error) throw error;
            onBack();
            onGroupUpdate();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Ошибка при удалении');
        }
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

                <div className="flex bg-black/40 rounded-xl p-1 shrink-0 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setShowChat(true)}
                        className={`px-4 sm:px-6 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap text-text-secondary hover:text-white flex items-center gap-2`}
                    >
                        <MessageSquare size={16} /> Чат
                    </button>
                    <button
                        onClick={() => setShowMembers(true)}
                        className={`px-4 sm:px-6 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap text-text-secondary hover:text-white flex items-center gap-2`}
                    >
                        <Users size={16} /> Участники <span className="text-xs opacity-50 ml-1">({members.length})</span>
                    </button>
                    {canManage && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`px-4 sm:px-6 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap text-text-secondary hover:text-white flex items-center gap-2`}
                        >
                            <Settings size={16} /> Настройки
                        </button>
                    )}
                </div>
            </header>

            {/* Chat Sidebar/Modal */}
            {showChat && (
                <div className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in" onClick={() => setShowChat(false)}>
                    <div className="w-full sm:w-[450px] h-full bg-[#0a0a0c] border-l border-white/10 shadow-2xl flex flex-col animate-slide-left" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h3 className="font-bold text-white flex items-center gap-2"><MessageSquare size={18} className="text-accent" /> Чат команды</h3>
                            <button onClick={() => setShowChat(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"><X size={18} /></button>
                        </div>
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
                    </div>
                </div>
            )}

            {/* Members Sidebar/Modal */}
            {showMembers && (
                <div className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in" onClick={() => setShowMembers(false)}>
                    <div className="w-full sm:w-[500px] lg:w-[800px] h-full bg-[#0a0a0c] border-l border-white/10 shadow-2xl flex flex-col animate-slide-left overflow-hidden relative" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02] sticky top-0 z-20">
                            <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-accent" /> Команда</h3>
                            <button onClick={() => setShowMembers(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8 bg-[#0a0a0c]">
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
                                                    <div
                                                        className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden shadow-inner shrink-0 ${profile?.avatar_url ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                                        onClick={() => profile?.avatar_url && setViewingAvatar(profile.avatar_url)}
                                                    >
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
                                                ) : searchQuery.length > 0 ? (
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
                                                ) : friends.length > 0 ? (
                                                    <div className="space-y-2 mt-4">
                                                        <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 px-2">Ваши друзья</p>
                                                        {friends.map(friend => {
                                                            const isAlreadyMember = members.some(m => m.user_id === friend.id);
                                                            return (
                                                                <div key={friend.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className="w-10 h-10 rounded-full bg-white/10 flex shrink-0 items-center justify-center text-white text-sm font-bold overflow-hidden">
                                                                            {friend.avatar_url ? (
                                                                                <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                friend.display_name?.charAt(0)?.toUpperCase()
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-accent transition-colors">{friend.display_name}</p>
                                                                            {friend.user_tag && <p className="text-[10px] text-text-secondary truncate mt-0.5">#{friend.user_tag}</p>}
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        disabled={isAlreadyMember}
                                                                        onClick={() => handleAddMember(friend.id)}
                                                                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-text-secondary hover:bg-accent hover:text-white disabled:opacity-30 transition-all active:scale-95 ml-2"
                                                                    >
                                                                        {isAlreadyMember ? <Check size={14} /> : <Plus size={14} />}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-6 text-sm font-medium text-text-secondary bg-white/5 rounded-xl border border-white/5">Введите имя или тег для поиска</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content: Tasks ALWAYS VISIBLE */}
            <div className="flex-1 overflow-hidden p-0 flex flex-col lg:flex-row w-full relative bg-transparent">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 w-full custom-scrollbar">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <h4 className="text-white font-bold text-lg flex items-center gap-2"><ListTodo size={20} className="text-accent" /> Задачи команды</h4>
                            <p className="text-xs text-text-secondary mt-1">Работайте сообща и достигайте целей</p>
                        </div>
                        <button
                            onClick={() => setShowTaskForm(!showTaskForm)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${showTaskForm
                                ? 'bg-white/10 text-white hover:bg-white/20'
                                : 'bg-accent text-white hover:bg-accent/80 shadow-lg shadow-accent/20'
                                }`}
                        >
                            {showTaskForm ? 'Отмена' : <><Plus size={16} /> Создать задачу</>}
                        </button>
                    </div>

                    {showTaskForm && (
                        <form onSubmit={handleCreateTask} className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 animate-fade-in relative">
                            <h5 className="text-white font-bold mb-4">Новая задача</h5>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Название задачи</label>
                                        <input
                                            type="text"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent outline-none transition-colors"
                                            placeholder="Что нужно сделать?"
                                            required
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Описание (необязательно)</label>
                                        <input
                                            type="text"
                                            value={newTaskDesc}
                                            onChange={(e) => setNewTaskDesc(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent outline-none transition-colors"
                                            placeholder="Подробности задачи"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Награда</label>
                                        <div className="flex bg-black/40 rounded-xl border border-white/10 p-1">
                                            <select
                                                value={newTaskRewardType}
                                                onChange={(e) => setNewTaskRewardType(e.target.value)}
                                                className="bg-transparent border-none text-white text-sm outline-none px-2 py-1.5 w-full cursor-pointer appearance-none"
                                            >
                                                <option value="points" className="bg-bg-primary text-white">Очки ✨</option>
                                                <option value="money" className="bg-bg-primary text-white">К ЗП 💵</option>
                                                <option value="duty" className="bg-bg-primary text-white">Обязанность 👔</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                                            {newTaskRewardType === 'points' ? 'Количество очков' : newTaskRewardType === 'money' ? 'Сумма ($/₽)' : 'Ценность (Скрыта)'}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={newTaskRewardType === 'duty'}
                                            value={newTaskValue}
                                            onChange={(e) => setNewTaskValue(e.target.value ? parseInt(e.target.value) : 0)}
                                            className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-center font-bold outline-none transition-colors ${newTaskRewardType === 'duty' ? 'opacity-50 text-text-secondary' : 'text-accent focus:border-accent'}`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Исполнитель</label>
                                        <div className="flex bg-black/40 rounded-xl border border-white/10 p-1">
                                            <select
                                                value={newTaskAssignedTo}
                                                onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                                                className="bg-transparent border-none text-white text-sm outline-none px-2 py-1.5 w-full cursor-pointer appearance-none"
                                            >
                                                <option value="" className="bg-bg-primary text-white">Все участники</option>
                                                {members.map(m => {
                                                    const p = profiles[m.user_id];
                                                    return <option key={m.user_id} value={m.user_id} className="bg-bg-primary text-white">{p?.display_name || m.user_id}</option>
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Матрица Эйзенхауэра</label>
                                        <div className="flex bg-black/40 rounded-xl border border-white/10 p-1">
                                            <select
                                                value={newTaskCategory}
                                                onChange={(e) => setNewTaskCategory(e.target.value)}
                                                className="bg-transparent border-none text-white text-sm outline-none px-2 py-1.5 w-full cursor-pointer appearance-none"
                                            >
                                                <option value="normal" className="bg-bg-primary text-white">Обычная</option>
                                                <option value="important" className="bg-bg-primary text-white">Важно, не срочно (План)</option>
                                                <option value="urgent" className="bg-bg-primary text-white">Срочно, не важно (Делегировать)</option>
                                                <option value="urgent_important" className="bg-bg-primary text-white text-warning">Важно и Срочно (Сделать сейчас)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowTaskForm(false);
                                            setEditingTaskId(null);
                                            setNewTaskTitle('');
                                            setNewTaskDesc('');
                                        }}
                                        className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-sm hover:bg-white/10 transition-colors mr-2"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newTaskTitle.trim()}
                                        className="px-6 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/80 transition-colors disabled:opacity-50"
                                    >
                                        {editingTaskId ? 'Сохранить изменения' : 'Создать задачу'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {tasks.length === 0 && !showTaskForm ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-12 opacity-60">
                            <ListTodo size={48} className="text-white/30 mb-4" />
                            <p className="text-white font-medium">Нет активных задач</p>
                            <p className="text-sm text-text-secondary mt-1 text-center">Создайте первую задачу для команды</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map(task => {
                                const creator = profiles[task.created_by];
                                const completer = task.completed_by ? profiles[task.completed_by] : null;
                                const canDelete = task.created_by === user.id || myRole === 'owner' || myRole === 'admin';

                                return (
                                    <div
                                        key={task.id}
                                        className={`p-4 rounded-2xl border transition-all ${task.completed
                                            ? 'bg-white/[0.02] border-white/5 opacity-70'
                                            : 'bg-white/5 border-white/10 hover:border-accent/40 shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <button
                                                onClick={() => handleToggleTask(task)}
                                                className={`mt-1 shrink-0 transition-all ${task.completed ? 'text-success' : 'text-text-secondary hover:text-accent'
                                                    }`}
                                            >
                                                {task.completed ? <CheckCircle size={22} className="fill-success/20" /> : <Circle size={22} />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className={`font-bold text-base truncate ${task.completed ? 'text-white/50 line-through' : 'text-white'}`}>
                                                        {task.title}
                                                    </h5>
                                                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${task.reward_type === 'points' ? 'bg-accent/20 text-accent' :
                                                        task.reward_type === 'money' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            'bg-white/10 text-white/50'
                                                        }`}>
                                                        {task.reward_type === 'points' ? `+${task.reward_amount || task.value} ✨` :
                                                            task.reward_type === 'money' ? `+${task.reward_amount || task.value} 💵` :
                                                                '👔 Обязанность'}
                                                    </span>
                                                    {task.category && task.category !== 'normal' && (
                                                        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest border ${task.category === 'urgent_important' ? 'border-danger text-danger bg-danger/10' :
                                                            task.category === 'important' ? 'border-warning text-warning bg-warning/10' :
                                                                'border-blue-400 text-blue-400 bg-blue-400/10'
                                                            }`}>
                                                            {task.category === 'urgent_important' ? 'Срочно & Важно' :
                                                                task.category === 'important' ? 'Важно' : 'Срочно'}
                                                        </span>
                                                    )}
                                                </div>

                                                {task.description && (
                                                    <p className={`text-sm mt-1 mb-2 ${task.completed ? 'text-white/30 truncate' : 'text-text-secondary line-clamp-2'}`}>
                                                        {task.description}
                                                    </p>
                                                )}

                                                <div className="mt-3 flex items-center justify-between text-xs font-medium text-text-secondary flex-wrap gap-2">
                                                    <div className="flex items-center gap-4 flex-wrap">
                                                        <div className="flex items-center gap-1.5" title="Кем создана">
                                                            <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                                                {creator?.avatar_url ? <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] text-white/50">{creator?.display_name?.charAt(0) || '?'}</span>}
                                                            </div>
                                                            <span>От: {creator?.display_name?.split(' ')[0] || '...'}</span>
                                                        </div>
                                                        {task.assigned_to && (
                                                            <div className="flex items-center gap-1 text-white/60">
                                                                <span>→</span>
                                                                <span>Кому: {profiles[task.assigned_to]?.display_name?.split(' ')[0] || '...'}</span>
                                                            </div>
                                                        )}
                                                        {task.completed && completer && (
                                                            <div className="flex items-center gap-1.5 text-success/80" title={`Выполнена: ${formatTime(task.completed_at)}`}>
                                                                <Check size={12} />
                                                                <span>Сделал(а): {completer?.display_name?.split(' ')[0] || '...'}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {canDelete && (
                                                        <div className="flex items-center gap-1 ml-auto">
                                                            <button
                                                                onClick={() => handleEditTask(task)}
                                                                className="text-white/20 hover:text-accent hover:bg-accent/10 p-1.5 rounded-lg transition-colors"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTask(task.id)}
                                                                className="text-white/20 hover:text-danger hover:bg-danger/10 p-1.5 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* AI Assistant Sidebar (Admin/Owner only) */}
                {canManage && (
                    <div className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 bg-black/20 flex flex-col h-[500px] lg:h-auto relative z-10">
                        <AIGroupAssistant
                            group={group}
                            user={user}
                            members={members}
                            profiles={profiles}
                            tasks={tasks}
                        />
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowSettings(false)}>
                    <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings size={20} className="text-accent" /> Настройки команды</h3>
                            <button onClick={() => setShowSettings(false)} className="text-text-secondary hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleUpdateGroup} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Название</label>
                                <input type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent outline-none" required />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Описание</label>
                                <textarea value={editGroupDesc} onChange={e => setEditGroupDesc(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent outline-none min-h-[80px]" />
                            </div>
                            <div className="pt-2 flex flex-col gap-3">
                                <button type="submit" className="w-full py-2.5 bg-accent text-white font-semibold rounded-xl hover:bg-accent/80 transition-all">Сохранить изменения</button>
                                {canManage && myRole === 'owner' && (
                                    <button type="button" onClick={handleDeleteGroup} className="w-full py-2.5 bg-danger/10 text-danger font-semibold rounded-xl hover:bg-danger hover:text-white transition-all flex items-center justify-center gap-2 mt-4"><Trash2 size={18} /> Удалить команду навсегда</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Avatar Viewer Modal */}
            {viewingAvatar && (
                <div
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out animate-fade-in"
                    onClick={() => setViewingAvatar(null)}
                >
                    <button
                        className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 border border-white/10 rounded-full transition-all"
                        onClick={() => setViewingAvatar(null)}
                    >
                        <X size={24} />
                    </button>
                    <div className="relative max-w-full max-h-full flex items-center justify-center p-2 rounded-[2rem] bg-white/5 border border-white/10 shadow-2xl overflow-hidden pointer-events-none">
                        <img
                            src={viewingAvatar}
                            alt="Profile Fullsize"
                            className="max-w-full max-h-[85vh] rounded-[1.5rem] object-contain pointer-events-auto shadow-[0_0_100px_rgba(255,255,255,0.05)] cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
