import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Search, UserPlus, Check, X, MessageCircle, Clock, Copy } from 'lucide-react';
import { useStore } from '../store/useStore';
import ChatView from './ChatView';

export default function FriendsView() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingFriends, setLoadingFriends] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [loadingSearch, setLoadingSearch] = useState(false);

    const [selectedFriend, setSelectedFriend] = useState(null);
    const [myProfile, setMyProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Получаем пользователя напрямую из Supabase Auth
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
            }
        });
    }, []);

    useEffect(() => {
        if (!user) return;
        loadMyProfile();
        loadFriends();
        loadRequests();

        // Subscription to friendships changes
        const channel = supabase.channel('friendships_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
                loadFriends();
                loadRequests();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const loadMyProfile = async () => {
        if (!user) return;
        try {
            // Попытка загрузить существующий профиль
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // Профиль не найден — создаём автоматически
                const tag = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
                const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Пользователь';
                const avatarUrl = user.user_metadata?.avatar_url || null;

                const { data: newProfile, error: insertError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        display_name: displayName,
                        avatar_url: avatarUrl,
                        email: user.email,
                        user_tag: tag,
                        level: 1,
                        is_online: true
                    }, { onConflict: 'id' })
                    .select('*')
                    .single();

                if (insertError) {
                    console.error('Error creating profile:', insertError);
                    setProfileError('Не удалось создать профиль: ' + insertError.message);
                } else if (newProfile) {
                    setMyProfile(newProfile);
                } else {
                    // upsert прошёл, но .select() не вернул данных — пробуем прочитать снова
                    const { data: retry } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                    if (retry) setMyProfile(retry);
                }
            } else if (error) {
                console.error('Database error loading profile:', error);
                setProfileError(error.message);
            } else if (data) {
                // Профиль найден, но может не хватать email/tag — дозаполняем
                if (!data.email || !data.user_tag) {
                    const updates = {};
                    if (!data.email) updates.email = user.email;
                    if (!data.user_tag) updates.user_tag = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');

                    const { data: updated, error: updateErr } = await supabase
                        .from('profiles')
                        .update(updates)
                        .eq('id', user.id)
                        .select('*')
                        .single();

                    if (!updateErr && updated) {
                        setMyProfile(updated);
                    } else {
                        setMyProfile(data); // показываем что есть
                    }
                } else {
                    setMyProfile(data);
                }
            }
        } catch (err) {
            console.error('Error loading my profile:', err);
            setProfileError(err.message || 'Ошибка сети');
        }
    };

    const loadFriends = async () => {
        if (!user) return;
        setLoadingFriends(true);
        try {
            // STEP 1: Get just the raw friendships (Blazing fast, no joins)
            const { data: rels, error: relsError } = await supabase
                .from('friendships')
                .select('id, status, user_id, friend_id')
                .eq('status', 'accepted')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            if (relsError) throw relsError;

            if (!rels || rels.length === 0) {
                setFriends([]);
                return;
            }

            // Extract all unique friend IDs (excluding the current user)
            const friendIds = rels.map(rel => rel.user_id === user.id ? rel.friend_id : rel.user_id);
            const uniqueFriendIds = [...new Set(friendIds)];

            // STEP 2: Fetch the profiles for those IDs (Blazing fast, simple IN query)
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, level, is_online')
                .in('id', uniqueFriendIds);

            if (profError) throw profError;

            // Combine the data manually to match the expected format
            const formattedFriends = rels.map(rel => {
                const isInitiator = rel.user_id === user.id;
                const targetId = isInitiator ? rel.friend_id : rel.user_id;
                const friendProfile = profiles.find(p => p.id === targetId);

                if (!friendProfile) return null;

                return {
                    relationship_id: rel.id,
                    ...friendProfile
                };
            }).filter(f => f !== null);

            setFriends(formattedFriends);
        } catch (error) {
            console.error('Error loading friends:', error);
        } finally {
            setLoadingFriends(false);
        }
    };

    const loadRequests = async () => {
        if (!user) return;
        setLoadingRequests(true);
        try {
            // STEP 1: Incoming requests where user_id is the sender and friend_id is ME
            const { data: rels, error: relsError } = await supabase
                .from('friendships')
                .select('id, status, user_id, friend_id')
                .eq('status', 'pending')
                .eq('friend_id', user.id);

            if (relsError) throw relsError;

            if (!rels || rels.length === 0) {
                setRequests([]);
                return;
            }

            // Extract sender IDs
            const senderIds = rels.map(rel => rel.user_id);
            const uniqueSenderIds = [...new Set(senderIds)];

            // STEP 2: Fetch the profiles for those senders
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, level')
                .in('id', uniqueSenderIds);

            if (profError) throw profError;

            // Combine the data
            const formattedRequests = rels.map(rel => {
                const profile = profiles.find(p => p.id === rel.user_id);
                return {
                    id: rel.id,
                    status: rel.status,
                    user_id: rel.user_id,
                    friend_id: rel.friend_id,
                    profile_user: profile
                };
            });

            setRequests(formattedRequests);
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        const query = searchQuery.trim();
        if (!query || !user) return;

        setLoadingSearch(true);
        try {
            let queryBuilder = supabase
                .from('profiles')
                .select('id, display_name, avatar_url, level, user_tag')
                .neq('id', user.id)
                .limit(20);

            if (query.includes('@')) {
                // Search by email
                queryBuilder = queryBuilder.eq('email', query);
            } else if (query.includes('#')) {
                // Search by Name#Tag
                const parts = query.split('#');
                if (parts.length === 2 && parts[0] && parts[1]) {
                    queryBuilder = queryBuilder.ilike('display_name', `%${parts[0]}%`).eq('user_tag', parts[1]);
                } else if (parts[1]) {
                    queryBuilder = queryBuilder.eq('user_tag', parts[1]);
                }
            } else {
                // General search (name)
                // If it's exactly 4 digits, try finding by tag too
                if (/^\d{4}$/.test(query)) {
                    queryBuilder = queryBuilder.or(`display_name.ilike.%${query}%,user_tag.eq.${query}`);
                } else {
                    queryBuilder = queryBuilder.ilike('display_name', `%${query}%`);
                }
            }

            const { data, error } = await queryBuilder;

            if (error) throw error;

            // Check existing relationship status for each result
            const { data: rels } = await supabase
                .from('friendships')
                .select('user_id, friend_id, status')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            const resultsWithStatus = data.map(profile => {
                const existingRel = rels?.find(r =>
                    (r.user_id === user.id && r.friend_id === profile.id) ||
                    (r.friend_id === user.id && r.user_id === profile.id)
                );
                return {
                    ...profile,
                    relationship_status: existingRel ? existingRel.status : null,
                    is_initiator: existingRel ? existingRel.user_id === user.id : false
                };
            });

            setSearchResults(resultsWithStatus);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoadingSearch(false);
        }
    };

    const sendRequest = async (friendId) => {
        try {
            const { error } = await supabase
                .from('friendships')
                .insert({
                    user_id: user.id,
                    friend_id: friendId,
                    status: 'pending'
                });
            if (error) throw error;

            // Update local search results state
            setSearchResults(prev => prev.map(p =>
                p.id === friendId ? { ...p, relationship_status: 'pending', is_initiator: true } : p
            ));
        } catch (error) {
            console.error('Error sending request:', error);
            alert('Ошибка: ' + (error.message || 'Не удалось отправить заявку'));
        }
    };

    const acceptRequest = async (relationshipId) => {
        try {
            const { error } = await supabase
                .from('friendships')
                .update({ status: 'accepted' })
                .eq('id', relationshipId);
            if (error) throw error;

            loadRequests();
            loadFriends();
        } catch (error) {
            console.error('Error accepting request:', error);
        }
    };

    const rejectRequest = async (relationshipId) => {
        try {
            const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', relationshipId);
            if (error) throw error;

            loadRequests();
        } catch (error) {
            console.error('Error rejecting request:', error);
        }
    };

    if (selectedFriend) {
        return <ChatView friend={selectedFriend} onBack={() => setSelectedFriend(null)} />;
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade-in relative z-10 w-full max-w-4xl mx-auto">
            {/* Header */}
            <header className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between pb-0 pt-8 sm:pt-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Users size={24} className="text-accent" />
                        Друзья
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">Находите единомышленников и общайтесь</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex px-6 pt-4 gap-6 border-b border-white/5 text-sm font-semibold">
                <button
                    onClick={() => setActiveTab('friends')}
                    className={`pb-4 border-b-2 transition-colors ${activeTab === 'friends' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-white'}`}
                >
                    Мои друзья {friends.length > 0 && `(${friends.length})`}
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`pb-4 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'requests' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-white'}`}
                >
                    Заявки
                    {requests.length > 0 && (
                        <span className="bg-danger text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                            {requests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('search')}
                    className={`pb-4 border-b-2 transition-colors ${activeTab === 'search' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-white'}`}
                >
                    Поиск людей
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

                {/* Search Tab */}
                {activeTab === 'search' && (
                    <div className="space-y-6">
                        {profileError && (
                            <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4 text-sm text-danger font-medium">
                                Ошибка загрузки вашего профиля: {profileError}.
                            </div>
                        )}
                        {myProfile && (
                            <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-1">Как друзья могут найти вас?</h4>
                                    <p className="text-xs text-text-secondary">Уникальный тег или Email</p>
                                </div>
                                <div className="flex flex-col sm:items-end gap-2">
                                    {myProfile.user_tag && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${myProfile.display_name}#${myProfile.user_tag}`);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                            className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-sm font-bold text-white flex items-center gap-2 hover:bg-white/10 hover:border-accent/30 transition-all cursor-pointer group"
                                            title="Нажмите, чтобы скопировать"
                                        >
                                            {myProfile.display_name}<span className="text-accent font-medium text-xs">#{myProfile.user_tag}</span>
                                            {copied ? (
                                                <Check size={14} className="text-success" />
                                            ) : (
                                                <Copy size={14} className="text-text-secondary group-hover:text-accent transition-colors" />
                                            )}
                                        </button>
                                    )}
                                    {myProfile.email && (
                                        <div className="text-xs font-medium text-text-secondary">
                                            {myProfile.email}
                                        </div>
                                    )}
                                    {copied && <span className="text-[10px] text-success font-medium animate-fade-in">Скопировано!</span>}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSearch} className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Введите Имя#Тег или Email..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-medium"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-xl text-sm font-medium transition-colors">
                                Найти
                            </button>
                        </form>

                        <div className="space-y-3">
                            {loadingSearch ? (
                                <div className="text-center py-12 flex justify-center">
                                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(profile => (
                                    <div key={profile.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden border border-white/10 shadow-lg">
                                                {profile.avatar_url ? (
                                                    <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    profile.display_name?.charAt(0)?.toUpperCase() || 'U'
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-base">
                                                    {profile.display_name}
                                                    {profile.user_tag && <span className="text-text-secondary/50 font-normal ml-1">#{profile.user_tag}</span>}
                                                </h4>
                                                <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">Lv. {profile.level}</span>
                                            </div>
                                        </div>

                                        <div>
                                            {profile.relationship_status === 'accepted' ? (
                                                <span className="text-sm font-medium text-text-secondary flex items-center gap-1"><Check size={16} /> Друзья</span>
                                            ) : profile.relationship_status === 'pending' ? (
                                                <span className="text-sm font-medium text-text-secondary flex items-center gap-1"><Clock size={16} /> {profile.is_initiator ? 'Заявка отправлена' : 'Входящая заявка'}</span>
                                            ) : (
                                                <button
                                                    onClick={() => sendRequest(profile.id)}
                                                    className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-bold px-4 py-2 rounded-xl transition-transform hover:scale-105"
                                                >
                                                    <UserPlus size={16} />
                                                    Добавить
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : searchQuery && !loadingSearch ? (
                                <div className="text-center py-8 text-text-secondary">Никого не найдено</div>
                            ) : (
                                <div className="text-center py-8 text-text-secondary/50">Здесь появятся результаты поиска</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                    <div className="space-y-3">
                        {loadingRequests ? (
                            <div className="text-center py-12 flex justify-center">
                                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : requests.length > 0 ? (
                            requests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden border border-white/10 shadow-lg">
                                            {req.profile_user?.avatar_url ? (
                                                <img src={req.profile_user.avatar_url} alt={req.profile_user.display_name} className="w-full h-full object-cover" />
                                            ) : (
                                                req.profile_user?.display_name?.charAt(0)?.toUpperCase() || 'U'
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-base">{req.profile_user?.display_name}</h4>
                                            <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">Lv. {req.profile_user?.level}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => acceptRequest(req.id)}
                                            className="w-10 h-10 rounded-full flex items-center justify-center bg-success/20 text-success hover:bg-success hover:text-white transition-colors border border-success/30 hover:border-success"
                                        >
                                            <Check size={18} />
                                        </button>
                                        <button
                                            onClick={() => rejectRequest(req.id)}
                                            className="w-10 h-10 rounded-full flex items-center justify-center bg-danger/20 text-danger hover:bg-danger hover:text-white transition-colors border border-danger/30 hover:border-danger"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-16 flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                    <Users size={24} className="text-text-secondary/50" />
                                </div>
                                <p className="text-text-secondary">Нет новых заявок в друзья</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Friends Tab */}
                {activeTab === 'friends' && (
                    <div className="space-y-3">
                        {loadingFriends ? (
                            <div className="text-center py-12 flex justify-center">
                                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : friends.length > 0 ? (
                            friends.map(friend => (
                                <div key={friend.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group cursor-pointer" onClick={() => setSelectedFriend(friend)}>
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden border border-white/10 shadow-lg">
                                                {friend.avatar_url ? (
                                                    <img src={friend.avatar_url} alt={friend.display_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    friend.display_name?.charAt(0)?.toUpperCase() || 'U'
                                                )}
                                            </div>
                                            {friend.is_online && (
                                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success border-2 border-[#16161a] rounded-full"></div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-base group-hover:text-accent transition-colors">{friend.display_name}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">Lv. {friend.level}</span>
                                                <span className="text-xs text-text-secondary">{friend.is_online ? 'В сети' : 'Не в сети'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-text-secondary hover:bg-accent hover:text-white transition-all hover:scale-110 shadow-lg group-hover:border-accent border border-transparent"
                                        onClick={(e) => { e.stopPropagation(); setSelectedFriend(friend); }}
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-16 flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                    <Users size={24} className="text-text-secondary/50" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Список друзей пуст</h3>
                                <p className="text-text-secondary max-w-sm">
                                    Перейдите на вкладку «Поиск людей», чтобы найти друзей и начать делиться своими достижениями!
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
