import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { getProfilesByIds, getProfileById } from '../lib/profileCache';
import { format } from 'date-fns';
import { ArrowLeft, Send, Users, Shield, UserPlus, Settings, LogOut, CheckCheck, Check, Search, Trash2, X, ListTodo, Plus, Circle, CheckCircle, Sparkles, Bot, Edit2, MessageSquare, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import AIGroupAssistant from './AIGroupAssistant';
import ConfirmModal from './ConfirmModal';
import PromptModal from './PromptModal';

export default function GroupChatView({ group, user, onBack, onGroupUpdate, initialOpenSettings }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    // Modals & Panels state
    const [activeGroupTab, setActiveGroupTab] = useState('tasks'); // 'tasks' | 'calendar'
    const [showChat, setShowChat] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [showSettings, setShowSettings] = useState(initialOpenSettings || false);

    // Unread count state
    const [unreadCount, setUnreadCount] = useState(0);

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
    const [newTaskDueDate, setNewTaskDueDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Modal Confirmations
    const [confirmConfig, setConfirmConfig] = useState(null);
    const [promptConfig, setPromptConfig] = useState(null);

    // Calendar state
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        let day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };
    const formatDateString = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const fullWeekDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];



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

        const handleProfileUpdate = async () => {
            if (!user?.id) return;
            const data = await getProfileById(user.id);
            if (data) {
                setProfiles(prev => ({ ...prev, [user.id]: data }));
            }
        };
        window.addEventListener('profileUpdated', handleProfileUpdate);

        return () => {
            supabase.removeChannel(msgsChannel);
            supabase.removeChannel(membersChannel);
            supabase.removeChannel(tasksChannel);
            window.removeEventListener('profileUpdated', handleProfileUpdate);
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

    // Update unread count
    useEffect(() => {
        if (!messages.length) return;

        const storageKey = `group_chat_last_read_${group.id}`;
        if (showChat) {
            setUnreadCount(0);
            localStorage.setItem(storageKey, new Date().toISOString());
        } else {
            const lastReadStr = localStorage.getItem(storageKey);
            if (!lastReadStr) {
                setUnreadCount(messages.filter(m => m.sender_id !== user?.id).length);
            } else {
                const lastReadTime = new Date(lastReadStr).getTime();
                const unread = messages.filter(m => m.sender_id !== user?.id && new Date(m.created_at).getTime() > lastReadTime);
                setUnreadCount(unread.length);
            }
        }
    }, [messages, showChat, group.id, user?.id]);

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
        const missingIds = userIds.filter(id => profiles[id] === undefined);
        if (missingIds.length === 0) return;

        try {
            const data = await getProfilesByIds(missingIds);
            if (!data) throw new Error('Could not fetch profiles');

            setProfiles(prev => {
                const newProfiles = { ...prev };
                data.forEach(p => newProfiles[p.id] = p);
                // Помечаем отсутствующие профили как null, чтобы не было бесконечной загрузки
                missingIds.forEach(id => {
                    if (newProfiles[id] === undefined) {
                        newProfiles[id] = null;
                    }
                });
                return newProfiles;
            });
        } catch (error) {
            console.error('Error loading profiles:', error);
            // При ошибке также снимаем статус "загрузки", чтобы не блокировать UI полностью
            setProfiles(prev => {
                const newProfiles = { ...prev };
                missingIds.forEach(id => {
                    if (newProfiles[id] === undefined) {
                        newProfiles[id] = null;
                    }
                });
                return newProfiles;
            });
        }
    };

    const loadFriends = async () => {
        try {
            // STEP 1: Fetch raw friendships
            const { data: rels, error: relsError } = await supabase
                .from('friendships')
                .select('status, user_id, friend_id')
                .eq('status', 'accepted')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            if (relsError) throw relsError;

            if (!rels || rels.length === 0) {
                setFriends([]);
                return;
            }

            // Extract unique friend IDs
            const friendIds = rels.map(rel => rel.user_id === user.id ? rel.friend_id : rel.user_id);
            const uniqueFriendIds = [...new Set(friendIds)];

            // STEP 2: Fetch profiles for those friends
            const profiles = await getProfilesByIds(uniqueFriendIds);

            setFriends(profiles || []);
        } catch (err) {
            console.error('Error loading friends in group chat:', err);
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
        setConfirmConfig({
            isOpen: true,
            title: targetUserId === user.id ? 'Покинуть команду?' : 'Исключить участника?',
            description: targetUserId === user.id ? 'Вы уверены, что хотите покинуть эту команду?' : 'Вы уверены, что хотите исключить этого пользователя из команды?',
            confirmText: targetUserId === user.id ? 'Да, покинуть' : 'Да, исключить',
            danger: true,
            onConfirm: async () => {
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
            }
        });
    };

    const handleChangeRole = async (targetUserId, newRole) => {
        const roleLabel = newRole === 'admin' ? 'Администратора' : newRole === 'owner' ? 'Владельца' : 'Участника';
        setConfirmConfig({
            isOpen: true,
            title: 'Смена роли',
            description: `Вы уверены, что хотите назначить этому пользователю роль <b>${roleLabel}</b>?`,
            confirmText: 'Да, назначить',
            danger: false,
            icon: Shield,
            onConfirm: async () => {
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
            }
        });
    };

    const formatTime = (dateStr) => {
        try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            let finalDueDate = newTaskDueDate || null;
            if (!finalDueDate && activeGroupTab === 'tasks') {
                // Если не указан срок сдачи, ставим на сегодня
                finalDueDate = new Date().toISOString().split('T')[0];
            }

            let req;
            if (editingTaskId) {
                req = supabase.from('group_tasks').update({
                    title: newTaskTitle.trim(),
                    description: newTaskDesc?.trim() || null,
                    value: Number(newTaskValue) || 0,
                    category: newTaskCategory,
                    assigned_to: newTaskAssignedTo || null,
                    due_date: finalDueDate
                }).eq('id', editingTaskId);
            } else {
                req = supabase.from('group_tasks').insert({
                    group_id: group.id,
                    title: newTaskTitle.trim(),
                    description: newTaskDesc?.trim() || null,
                    value: Number(newTaskValue) || 0,
                    created_by: user.id,
                    category: newTaskCategory,
                    assigned_to: newTaskAssignedTo || null,
                    due_date: finalDueDate
                });
            }
            const { error } = await req;
            if (error) throw error;

            if (!editingTaskId && activeGroupTab === 'calendar' && selectedDate && !newTaskDueDate) {
                // Если создавали из календаря и дата не была выставлена вручную, но мы в календаре - ничего не делаем доп., 
                // но лучше чтобы дата бралась из selectedDate по умолчанию (установлено в кнопке добавления)
            }

            setNewTaskTitle('');
            setNewTaskDesc('');
            setNewTaskRewardType('points');
            setNewTaskValue(10);
            setNewTaskCategory('normal');
            setNewTaskAssignedTo('');
            setNewTaskDueDate('');
            setEditingTaskId(null);
            setShowTaskForm(false);
            loadTasks();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Ошибка при сохранении задачи');
        }
    };

    const handleEditTask = (task) => {
        setEditingTaskId(task.id);
        setNewTaskTitle(task.title);
        setNewTaskDesc(task.description || '');
        setNewTaskRewardType(task.reward_type);
        setNewTaskValue(task.value || task.reward_amount || 0);
        setNewTaskCategory(task.category || 'normal');
        setNewTaskAssignedTo(task.assigned_to || '');
        setNewTaskDueDate(task.due_date || '');
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
        setConfirmConfig({
            isOpen: true,
            title: 'Удалить задачу?',
            description: 'Вы уверены, что хотите безвозвратно удалить эту командную задачу?',
            confirmText: 'Да, удалить',
            danger: true,
            onConfirm: async () => {
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
            }
        });
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
        setPromptConfig({
            isOpen: true,
            title: 'Удалить команду?',
            description: `Это действие необратимо. Будут удалены все участники, календарь и список задач.\nДля подтверждения введите точное название команды: <br/><strong class="text-white">${group.name}</strong>`,
            placeholder: 'Название команды',
            expectedValue: group.name,
            confirmText: 'Удалить навсегда',
            cancelText: 'Отмена',
            danger: true,
            icon: Trash2,
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from('groups').delete().eq('id', group.id);
                    if (error) throw error;
                    onBack();
                    onGroupUpdate();
                } catch (err) {
                    console.error('Delete error:', err);
                    alert('Ошибка при удалении');
                }
            }
        });
    };

    return (
        <div className="flex flex-col bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade-in relative z-10 w-full max-w-5xl mx-auto" style={{ minHeight: '75vh', maxHeight: '85vh' }}>
            {/* Header */}
            <header className="p-3 sm:p-4 border-b border-white/5 bg-white/[0.02] flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-all shrink-0">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-3 w-full min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-lg shadow-inner shrink-0">
                            {group.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h3 className="font-bold text-white text-base leading-tight truncate">{group.name}</h3>
                            <p className="text-xs text-text-secondary mt-0.5 truncate">{members.length} участников · Роль: {myRole}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap xl:flex-nowrap bg-black/40 rounded-xl p-1 shrink-0 gap-1 w-full xl:w-auto">
                    <button
                        onClick={() => setActiveGroupTab('tasks')}
                        className={`flex-1 xl:flex-none px-2 sm:px-6 py-2 text-[13px] sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex justify-center items-center gap-1.5 sm:gap-2 ${activeGroupTab === 'tasks' ? 'bg-white/10 text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                    >
                        <ListTodo size={16} /> Задачи
                    </button>
                    <button
                        onClick={() => setActiveGroupTab('calendar')}
                        className={`flex-1 xl:flex-none px-2 sm:px-6 py-2 text-[13px] sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex justify-center items-center gap-1.5 sm:gap-2 ${activeGroupTab === 'calendar' ? 'bg-white/10 text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                    >
                        <Calendar size={16} /> Календарь
                    </button>

                    <div className="hidden xl:block w-px h-6 bg-white/10 mx-2 self-center shrink-0"></div>

                    <button
                        onClick={() => setShowChat(true)}
                        className={`flex-1 xl:flex-none px-2 sm:px-6 py-2 text-[13px] sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap text-text-secondary hover:text-white flex justify-center items-center gap-1.5 sm:gap-2 relative`}
                    >
                        <MessageSquare size={16} /> Чат
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-2 w-4 h-4 bg-danger text-white text-[9px] font-bold flex items-center justify-center rounded-full shadow-lg shadow-danger/50 mt-[-4px]">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setShowMembers(true)}
                        className={`flex-1 xl:flex-none px-2 sm:px-6 py-2 text-[13px] sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap text-text-secondary hover:text-white flex justify-center items-center gap-1.5 sm:gap-2`}
                    >
                        <Users size={16} /> <span className="hidden sm:inline">Участники</span><span className="sm:hidden">Уч.</span> <span className="text-xs opacity-50 ml-0.5">({members.length})</span>
                    </button>
                    {canManage && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`flex-1 xl:flex-none px-2 sm:px-6 py-2 text-[13px] sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap text-text-secondary hover:text-white flex justify-center items-center gap-1.5 sm:gap-2`}
                        >
                            <Settings size={16} /> Настр.
                        </button>
                    )}
                </div>
            </header>

            {/* Chat Sidebar/Modal */}
            {showChat && (
                <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex justify-end animate-fade-in" onClick={() => setShowChat(false)}>
                    <div className="w-full sm:w-[450px] h-full bg-bg-primary border-l border-white/20 shadow-[-20px_0_50px_rgba(0,0,0,0.6)] flex flex-col animate-slide-left relative shadow-inner-light" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
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

                                    // Обработка дат
                                    const msgDate = msg.created_at ? new Date(msg.created_at) : new Date();
                                    const dateStr = msgDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                                    let showDateSeparator = false;
                                    if (i === 0) {
                                        showDateSeparator = true;
                                    } else {
                                        const prevDate = messages[i - 1].created_at ? new Date(messages[i - 1].created_at) : new Date();
                                        if (msgDate.toDateString() !== prevDate.toDateString()) {
                                            showDateSeparator = true;
                                        }
                                    }

                                    return (
                                        <React.Fragment key={msg.id || i}>
                                            {showDateSeparator && (
                                                <div className="flex justify-center my-4 w-full">
                                                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] font-semibold tracking-wider text-text-secondary">
                                                        {msgDate.toDateString() === new Date().toDateString() ? 'Сегодня' :
                                                            msgDate.toDateString() === new Date(Date.now() - 86400000).toDateString() ? 'Вчера' :
                                                                dateStr}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`flex max-w-[80%] md:max-w-[70%] ${isMine ? 'self-end' : 'self-start'} gap-2 ${isOptimistic ? 'opacity-70' : ''} animate-fade-in`}>
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
                                                        : 'bg-white/10 border border-white/10 text-white rounded-2xl rounded-bl-md shadow-md/50'
                                                        } relative`}>
                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                                        <div className="flex items-center justify-end gap-1 mt-1">
                                                            <span className="text-[9px] opacity-50 font-medium">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
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
                                        </React.Fragment>
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
                <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex justify-end animate-fade-in" onClick={() => setShowMembers(false)}>
                    <div className="w-full sm:w-[450px] h-full bg-bg-primary border-l border-white/20 shadow-[-20px_0_50px_rgba(0,0,0,0.6)] flex flex-col animate-slide-left relative shadow-inner-light" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
                            <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-accent" /> Участники команды</h3>
                            <button onClick={() => setShowMembers(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 bg-bg-primary relative">
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

                                                <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                                <div className="w-full shrink-0 mt-2">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 shadow-lg relative">
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

            {/* Main Content: Tasks or Calendar */}
            <div className="flex-1 overflow-hidden p-0 flex flex-col lg:flex-row w-full relative bg-transparent">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 w-full custom-scrollbar">
                    {activeGroupTab === 'tasks' ? (
                        <>
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
                                                {members.length > 0 && members.some(m => profiles[m.user_id] === undefined) ? (
                                                    <div className="flex bg-black/40 rounded-xl border border-white/10 px-3 py-2.5">
                                                        <div className="flex items-center gap-2 text-white/50 text-sm">
                                                            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                                                            <span>Загрузка...</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex bg-black/40 rounded-xl border border-white/10 p-1">
                                                        <select
                                                            value={newTaskAssignedTo}
                                                            onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                                                            className="bg-transparent border-none text-white text-sm outline-none px-2 py-1.5 w-full cursor-pointer appearance-none"
                                                        >
                                                            <option value="" className="bg-bg-primary text-white">Все участники</option>
                                                            {members.map(m => {
                                                                const p = profiles[m.user_id];
                                                                if (!p) return null;
                                                                const name = p?.display_name 
                                                                    ? `${p.display_name}${p.user_tag ? ' #' + p.user_tag : ''}` 
                                                                    : (p ? 'Без имени' : `Участник (${m.user_id.substring(0,4)}...)`);
                                                                return (
                                                                    <option key={m.user_id} value={m.user_id} className="bg-bg-primary text-white">
                                                                        {name}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Крайний срок (по умолч. сегодня)</label>
                                                <div 
                                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent outline-none transition-colors cursor-pointer flex justify-between items-center"
                                                >
                                                    <span className={newTaskDueDate ? "text-white font-medium" : "text-text-secondary"}>
                                                        {newTaskDueDate ? newTaskDueDate.split('-').reverse().join('.') : "Сегодня"}
                                                    </span>
                                                    <Calendar size={16} className="text-text-secondary" />
                                                </div>
                                                
                                                {showDatePicker && (
                                                    <div className="absolute top-full mt-2 left-0 right-0 sm:right-auto sm:w-80 bg-[#0d0a12] border border-white/20 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in" onClick={e => e.stopPropagation()}>
                                                        <div className="flex justify-between items-center mb-4">
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => { e.preventDefault(); setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)); }}
                                                                className="text-text-secondary hover:text-white transition-colors"
                                                            ><ChevronLeft size={20} /></button>
                                                            <div className="font-bold text-white relative">
                                                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => { e.preventDefault(); setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)); }}
                                                                className="text-text-secondary hover:text-white transition-colors"
                                                            ><ChevronRight size={20} /></button>
                                                        </div>
                                                        <div className="grid grid-cols-7 gap-1 mb-2">
                                                            {weekDays.map(day => (
                                                                <div key={`d-${day}`} className="text-center text-[10px] font-bold text-text-secondary uppercase">{day}</div>
                                                            ))}
                                                        </div>
                                                        <div className="grid grid-cols-7 gap-1">
                                                            {Array.from({ length: getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth()) }).map((_, i) => (
                                                                <div key={`emp-${i}`} className="h-8"></div>
                                                            ))}
                                                            {Array.from({ length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }).map((_, i) => {
                                                                const day = i + 1;
                                                                const dayStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
                                                                const isSelected = newTaskDueDate === dayStr;
                                                                const isToday = dayStr === new Date().toISOString().split('T')[0];
                                                                
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={`day-${day}`}
                                                                        onClick={() => {
                                                                            setNewTaskDueDate(dayStr);
                                                                            setShowDatePicker(false);
                                                                        }}
                                                                        className={`h-8 w-full rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${isSelected ? 'bg-accent text-white shadow-md' : isToday ? 'bg-white/10 text-white ring-1 ring-white/20' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                                                                    >
                                                                        {day}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className="mt-4 pt-3 border-t border-white/10 flex justify-between">
                                                            <button 
                                                                type="button"
                                                                onClick={() => { setNewTaskDueDate(''); setShowDatePicker(false); }}
                                                                className="text-xs font-semibold text-text-secondary hover:text-white transition-colors px-2 py-1"
                                                            >
                                                                Сбросить
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setShowDatePicker(false)}
                                                                className="text-xs font-bold text-accent hover:text-white transition-colors px-3 py-1 bg-accent/10 rounded-lg"
                                                            >
                                                                Готово
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="sm:col-span-2">
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
                                        // Если мы в Табе Задач, скрываем календарные задачи? Нет, можно просто показывать все, либо показывать только без дат/с датой сегодня. 
                                        // Логичнее показывать вообще все актуальные задачи в списке.

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
                                                                {task.due_date && (
                                                                    <div className="flex items-center gap-1 text-accent/80">
                                                                        <Calendar size={12} />
                                                                        <span>Срок: {task.due_date.split('-').reverse().join('.')}</span>
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
                        </>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                    <Calendar size={20} className="text-accent" />
                                    Календарь Команды
                                </h2>
                                <div className="flex items-center gap-2 sm:gap-4 bg-bg-secondary px-2 sm:px-3 py-1.5 rounded-xl border border-white/10">
                                    <button onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)); setSelectedDate(null); }} className="hover:text-accent font-semibold transition-colors text-white"><ChevronLeft size={20} /></button>
                                    <div className="relative flex items-center justify-center min-w-[100px] z-10">
                                        <button onClick={() => setShowMonthPicker(!showMonthPicker)} className="font-semibold text-center text-sm hover:text-accent transition-colors px-2 py-1 rounded-md text-white">
                                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                        </button>
                                        {showMonthPicker && (
                                            <div className="absolute top-full mt-2 bg-bg-secondary border border-white/10 rounded-xl shadow-2xl p-3 w-64 animate-fade-in right-0 sm:right-auto z-50">
                                                <div className="grid grid-cols-3 gap-2">
                                                    {monthNames.map((m, index) => (
                                                        <button
                                                            key={m}
                                                            onClick={() => {
                                                                setCurrentDate(new Date(currentDate.getFullYear(), index, 1));
                                                                setSelectedDate(null);
                                                                setShowMonthPicker(false);
                                                            }}
                                                            className={`text-xs py-2 rounded-lg transition-colors font-medium text-white ${currentDate.getMonth() === index ? 'bg-accent' : 'hover:bg-white/10'}`}
                                                        >
                                                            {m.substring(0, 3)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)); setSelectedDate(null); }} className="hover:text-accent font-semibold transition-colors text-white"><ChevronRight size={20} /></button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                                {weekDays.map(day => (
                                    <div key={day} className="text-center font-bold text-text-secondary text-xs uppercase py-2 tracking-wider">{day}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                {Array.from({ length: getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth()) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="h-16 md:h-24"></div>
                                ))}
                                {Array.from({ length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }).map((_, i) => {
                                    const day = i + 1;
                                    const dayStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
                                    const isSelected = selectedDate === dayStr;
                                    const isToday = dayStr === new Date().toISOString().split('T')[0];

                                    const tasksForDay = tasks.filter(t => t.due_date === dayStr);
                                    const totalCount = tasksForDay.length;
                                    const completedCount = tasksForDay.filter(t => t.completed).length;
                                    const uncompletedCount = totalCount - completedCount;
                                    const points = tasksForDay.reduce((sum, task) => sum + (task.value || 0), 0);

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => setSelectedDate(selectedDate === dayStr ? null : dayStr)}
                                            className={`h-16 md:h-24 rounded-2xl flex flex-col items-center justify-start p-1.5 md:p-3 text-sm transition-all duration-300 border relative group overflow-hidden
                                                ${isSelected ? 'bg-accent/20 border-accent/50 text-accent shadow-[0_0_20px_rgba(var(--color-accent),0.3)] scale-[1.02] z-10' :
                                                    totalCount > 0 ? 'bg-bg-primary border-accent/20 hover:border-accent/50 text-white hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(var(--color-accent),0.1)]' :
                                                        'bg-bg-secondary/80 border-border/50 hover:border-white/20 text-text-secondary hover:bg-bg-secondary'}
                                                ${isToday && !isSelected ? 'ring-2 ring-white/20 bg-white/10' : ''}`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                            <span className={`font-bold text-lg md:text-xl relative z-10 ${isToday ? 'text-white drop-shadow-md' : ''} ${isSelected ? 'text-accent drop-shadow-[0_0_8px_rgba(var(--color-accent),0.8)]' : ''}`}>{day}</span>
                                            {totalCount > 0 && (
                                                <div className="mt-auto w-full flex flex-col items-center gap-1 md:gap-1.5 relative z-10">
                                                    <div className="flex gap-1 justify-center items-center max-w-full px-1">
                                                        {Array.from({ length: Math.min(completedCount, 3) }).map((_, idx) => (
                                                            <div key={`c-${idx}`} className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-success shadow-[0_0_5px_rgba(34,197,94,0.6)] shrink-0"></div>
                                                        ))}
                                                        {Array.from({ length: Math.min(uncompletedCount, Math.max(0, 3 - completedCount)) }).map((_, idx) => (
                                                            <div key={`u-${idx}`} className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent shadow-[0_0_5px_rgba(var(--color-accent),0.6)] shrink-0"></div>
                                                        ))}
                                                        {totalCount > 3 && (
                                                            <span className="text-[7px] md:text-[8px] font-bold text-white/80 ml-0.5 leading-none">+{totalCount - 3}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center leading-none mt-1 w-[90%] mx-auto">
                                                        <span className="text-[8px] md:text-[9px] font-black tracking-wider text-white opacity-90 truncate w-full text-center">
                                                            {totalCount} {totalCount === 1 ? 'задача' : (totalCount % 10 >= 2 && totalCount % 10 <= 4 && (totalCount % 100 < 10 || totalCount % 100 >= 20)) ? 'задачи' : 'задач'}
                                                        </span>
                                                        <span className={`text-[7px] md:text-[8px] tracking-wide py-[2px] px-1 md:px-1.5 rounded bg-black/60 shadow-inner mt-[3px] w-full text-center truncate text-accent`}>
                                                            {tasksForDay.filter(t => t.completed).reduce((s, t) => s + (t.value || 0), 0)} / {points} очк
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedDate && (
                                <div className="mt-6 p-5 bg-white/5 rounded-2xl border border-white/10 animate-fade-in relative z-20">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg text-white">План на {selectedDate.split('-').reverse().join('.')}</h3>
                                        <button
                                            onClick={() => {
                                                setNewTaskDueDate(selectedDate);
                                                setActiveGroupTab('tasks');
                                                setShowTaskForm(true);
                                                // auto scroll to form logic could be added here
                                            }}
                                            className="px-4 py-2 bg-accent/20 text-accent hover:bg-accent hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                        >
                                            <Plus size={14} /> Добавить
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {tasks.filter(t => t.due_date === selectedDate).length === 0 ? (
                                            <p className="text-sm text-text-secondary italic">На этот день задач нет.</p>
                                        ) : (
                                            tasks.filter(t => t.due_date === selectedDate).map(task => {
                                                const creator = profiles[task.created_by];
                                                return (
                                                    <div key={task.id} className={`p-3 rounded-xl border flex gap-3 transition-colors ${task.completed ? 'bg-white/5 border-transparent opacity-50' : 'bg-bg-primary border-white/10'}`}>
                                                        <button onClick={() => handleToggleTask(task)} className={`mt-0.5 shrink-0 ${task.completed ? 'text-success' : 'text-text-secondary hover:text-accent'}`}>
                                                            {task.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-semibold truncate ${task.completed ? 'line-through' : 'text-white'}`}>{task.title}</span>
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-accent/20 text-accent ml-auto">+{task.reward_amount || task.value}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-text-secondary">
                                                                <span>От: {creator?.display_name?.split(' ')[0] || '...'}</span>
                                                                {task.assigned_to && <span>Кому: {profiles[task.assigned_to]?.display_name?.split(' ')[0] || '...'}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
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
            {
                showSettings && (
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
                )
            }

            {/* Avatar Viewer Modal */}
            {
                viewingAvatar && (
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
                )
            }

            {/* Modal Confirmations */}
            {confirmConfig && (
                <ConfirmModal
                    {...confirmConfig}
                    onClose={() => setConfirmConfig(null)}
                />
            )}
            
            {promptConfig && (
                <PromptModal
                    {...promptConfig}
                    onClose={() => setPromptConfig(null)}
                />
            )}
        </div >
    );
}
