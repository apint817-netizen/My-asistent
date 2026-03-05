import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Plus, Search, User, ArrowRight, Settings, Trash2 } from 'lucide-react';
import GroupChatView from './GroupChatView';

export default function GroupsView() {
    const [user, setUser] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState(null); // Если выбрана группа, показываем чат

    // Create group state
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                loadGroups(session.user.id);
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

            setNewGroupName('');
            setNewGroupDesc('');
            setIsCreating(false);
            loadGroups(user.id);
        } catch (error) {
            console.error('Error creating group:', error);
            alert(`Ошибка при создании команды: ${error.message || 'Неизвестная ошибка'}`);
        }
    };

    if (!user) return null;

    if (activeGroup) {
        return <GroupChatView group={activeGroup} user={user} onBack={() => setActiveGroup(null)} onGroupUpdate={() => loadGroups(user.id)} />;
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
                    onClick={() => setIsCreating(!isCreating)}
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
                                className="bg-white/5 border border-white/10 hover:border-accent/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/10 group animate-fade-in"
                                onClick={() => setActiveGroup(group)}
                            >
                                <div className="flex items-start gap-4 mb-4">
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
        </div>
    );
}
