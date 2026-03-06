import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Plus, Search, User, ArrowRight, Settings, Trash2 } from 'lucide-react';
import GroupChatView from './GroupChatView';

export default function GroupsView() {
    const [user, setUser] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState(null); // Если выбрана группа, показываем чат
    const [openGroupSettings, setOpenGroupSettings] = useState(false);

    // Delete confirmation state
    const [groupToDelete, setGroupToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Create group state
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [friends, setFriends] = useState([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                loadGroups(session.user.id);
                loadFriends(session.user.id);
            }
        });
    }, []);

    const loadGroups = async (userId) => {
        setLoading(true);
        try {
            // Загружаем группы, в которых состоит пользователь
            const { data, error } = await supabase
                .from('groups')
                .select(`
                    id, name, description, avatar_url, creator_id,
                    group_members!inner(user_id, role)
                `)
                .eq('group_members.user_id', userId);

            if (error) throw error;
            setGroups(data || []);
        } catch (error) {
            console.error('Error loading groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFriends = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    status, user_id, friend_id,
                    profile_user:profiles!friendships_user_id_fkey(id, display_name, avatar_url, user_tag),
                    profile_friend:profiles!friendships_friend_id_fkey(id, display_name, avatar_url, user_tag)
                `)
                .eq('status', 'accepted')
                .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

            if (error) throw error;
            const formattedFriends = data.map(rel => {
                const isInitiator = rel.user_id === userId;
                return isInitiator ? rel.profile_friend : rel.profile_user;
            }).filter(f => f && f.id);

            setFriends(formattedFriends);
        } catch (err) {
            console.error('Error loading friends:', err);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim() || !user) return;

        try {
            // 1. Создание группы
            const { data: groupData, error: groupError } = await supabase
                .from('groups')
                .insert({
                    name: newGroupName.trim(),
                    description: newGroupDesc.trim(),
                    creator_id: user.id
                })
                .select()
                .single();

            if (groupError) throw groupError;

            // 2. Добавление создателя как owner
            const { error: memberError } = await supabase
                .from('group_members')
                .insert({
                    group_id: groupData.id,
                    user_id: user.id,
                    role: 'owner'
                });

            if (memberError) throw memberError;

            // 3. Добавление выбранных друзей
            if (selectedFriends.length > 0) {
                const invites = selectedFriends.map(friendId => ({
                    group_id: groupData.id,
                    user_id: friendId,
                    role: 'member'
                }));
                const { error: invitesError } = await supabase.from('group_members').insert(invites);
                if (invitesError) console.error('Error inviting friends:', invitesError);
            }

            setNewGroupName('');
            setNewGroupDesc('');
            setSelectedFriends([]);
            setIsCreating(false);
            loadGroups(user.id);
        } catch (error) {
            console.error('Error creating group:', error);
            alert(`Ошибка при создании команды: ${error.message || 'Неизвестная ошибка'}`);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!groupToDelete) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('groups').delete().eq('id', groupToDelete.id);
            if (error) throw error;
            setGroupToDelete(null);
            loadGroups(user.id);
        } catch (error) {
            console.error('Error deleting group:', error);
            alert(`Ошибка при удалении: ${error.message || 'Неизвестная ошибка'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!user) return null;

    if (activeGroup) {
        return <GroupChatView
            group={activeGroup}
            user={user}
            onBack={() => { setActiveGroup(null); setOpenGroupSettings(false); }}
            onGroupUpdate={() => loadGroups(user.id)}
            initialOpenSettings={openGroupSettings}
        />;
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Shield className="text-accent" /> Команды
                    </h2>
                    <p className="text-text-secondary text-sm mt-1">Организуйте совместную работу и общайтесь с коллегами</p>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(!isCreating);
                        if (!isCreating) {
                            setNewGroupName('');
                            setNewGroupDesc('');
                            setSelectedFriends([]);
                        }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${isCreating
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-accent text-white hover:bg-accent/80 shadow-lg shadow-accent/20'
                        }`}
                >
                    {isCreating ? 'Отмена' : <><Plus size={16} /> Создать команду</>}
                </button>
            </div>

            {isCreating && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-fade-in shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-4">Создание новой команды</h3>
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Название команды</label>
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-accent"
                                placeholder="Например: Отдел маркетинга"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Описание (необязательно)</label>
                            <input
                                type="text"
                                value={newGroupDesc}
                                onChange={(e) => setNewGroupDesc(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-accent"
                                placeholder="Например: Обсуждение текущих проектов"
                            />
                        </div>

                        {friends.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Пригласить друзей</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {friends.map(friend => {
                                        const isSelected = selectedFriends.includes(friend.id);
                                        return (
                                            <div
                                                key={friend.id}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedFriends(prev => prev.filter(id => id !== friend.id));
                                                    } else {
                                                        setSelectedFriends(prev => [...prev, friend.id]);
                                                    }
                                                }}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                                    ? 'bg-accent/20 border-accent/50'
                                                    : 'bg-white/5 border-transparent hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/50 flex shrink-0 items-center justify-center text-white text-xs font-bold overflow-hidden shadow-inner">
                                                    {friend.avatar_url ? (
                                                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        friend.display_name?.charAt(0)?.toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-white truncate leading-tight">{friend.display_name}</p>
                                                    {friend.user_tag && <p className="text-[10px] text-text-secondary truncate mt-0.5">#{friend.user_tag}</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={!newGroupName.trim()}
                                className="px-6 py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent/80 transition-colors disabled:opacity-50"
                            >
                                Воплотить в жизнь
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full py-12 flex justify-center">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                        <Shield size={48} className="mx-auto text-white/20 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">У вас пока нет команд</h3>
                        <p className="text-text-secondary mb-6">Создайте новую команду или попросите коллег пригласить вас</p>
                    </div>
                ) : (
                    groups.map(group => {
                        const initLetters = group.name.substring(0, 2).toUpperCase();
                        const myRole = group.group_members?.find(m => m.user_id === user.id)?.role || 'member';
                        const membersCount = group.group_members?.length || 1;

                        return (
                            <div
                                key={group.id}
                                className="bg-white/5 border border-white/10 hover:border-accent/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/10 group animate-fade-in relative overflow-hidden"
                                onClick={() => {
                                    setOpenGroupSettings(false);
                                    setActiveGroup(group);
                                }}
                            >
                                {/* Кнопки быстрого управления для админов/оунеров */}
                                {(myRole === 'owner' || myRole === 'admin') && (
                                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenGroupSettings(true);
                                                setActiveGroup(group);
                                            }}
                                            className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
                                            title="Настройки"
                                        >
                                            <Settings size={14} />
                                        </button>
                                        {myRole === 'owner' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setGroupToDelete(group);
                                                }}
                                                className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/20 hover:border-danger/30 transition-colors backdrop-blur-md"
                                                title="Удалить команду"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-start gap-4 mb-4 relative z-0">
                                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                        {initLetters}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold truncate text-lg leading-tight group-hover:text-accent transition-colors">{group.name}</h3>
                                        <p className="text-text-secondary text-sm truncate mt-0.5">{group.description || 'Нет описания'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-white/60">
                                        <User size={14} />
                                        <span>{membersCount} {membersCount === 1 ? 'участник' : membersCount >= 2 && membersCount <= 4 ? 'участника' : 'участников'}</span>
                                    </div>
                                    <div className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${myRole === 'owner' ? 'bg-warning/20 text-warning' :
                                        myRole === 'admin' ? 'bg-success/20 text-success' :
                                            'bg-white/10 text-text-secondary'
                                        }`}>
                                        {myRole === 'owner' ? 'Создатель' : myRole === 'admin' ? 'Админ' : 'Участник'}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Модальное окно удаления */}
            {groupToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-bg-secondary border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-2">Удалить команду?</h3>
                        <p className="text-text-secondary mb-6">
                            Вы уверены, что хотите удалить команду <span className="text-white font-semibold">"{groupToDelete.name}"</span>? Это действие нельзя отменить, вся история чата и задачи Команды будут безвозвратно удалены.
                        </p>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setGroupToDelete(null)}
                                disabled={isDeleting}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:text-white hover:bg-white/5 transition-all"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-danger text-white hover:bg-danger/80 transition-all flex items-center gap-2"
                            >
                                {isDeleting ? (
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                Удалить безвозвратно
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
