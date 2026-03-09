import React, { useState } from 'react';
import { Users, Shield } from 'lucide-react';
import FriendsView from './FriendsView';
import GroupsView from './GroupsView';

export default function SocialView() {
    const [subTab, setSubTab] = useState('friends');

    return (
        <div className="flex flex-col flex-1 min-h-0 animate-fade-in">
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setSubTab('friends')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        subTab === 'friends'
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'bg-white/5 text-text-secondary border border-transparent active:bg-white/10'
                    }`}
                >
                    <Users size={16} />
                    Друзья
                </button>
                <button
                    onClick={() => setSubTab('teams')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        subTab === 'teams'
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'bg-white/5 text-text-secondary border border-transparent active:bg-white/10'
                    }`}
                >
                    <Shield size={16} />
                    Команды
                </button>
            </div>

            {/* Content — reuse existing components directly */}
            {subTab === 'friends' ? <FriendsView /> : <GroupsView />}
        </div>
    );
}
