import React from 'react';
import { ListTodo, Calendar as CalendarIcon, Users, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { playHoverSound } from '../utils/sound';

export default function BottomNavigation() {
    const activeTab = useStore(state => state.activeTab);
    const setActiveTab = useStore(state => state.setActiveTab);

    const tabs = [
        { id: 'dashboard', icon: ListTodo, label: 'Задачи' },
        { id: 'calendar', icon: CalendarIcon, label: 'Планы' },
        { id: 'social', icon: Users, label: 'Общение' },
        { id: 'profile', icon: User, label: 'Профиль' }
    ];

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0c]/95 backdrop-blur-xl border-t border-white/10 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex justify-around items-center px-2 py-1.5">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onMouseEnter={playHoverSound}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-col items-center justify-center min-w-[64px] h-12 rounded-xl transition-all ${
                                isActive 
                                    ? 'text-accent' 
                                    : 'text-text-secondary active:text-white active:bg-white/5'
                            }`}
                        >
                            <div className={`relative flex items-center justify-center transition-transform duration-300 ${isActive ? '-translate-y-0.5' : ''}`}>
                                {isActive && (
                                    <div className="absolute inset-0 bg-accent/20 blur-md rounded-full scale-150" />
                                )}
                                <Icon size={22} className={isActive ? 'relative z-10 drop-shadow-[0_0_8px_rgba(109,40,217,0.6)]' : ''} />
                            </div>
                            <span className={`text-[11px] mt-0.5 font-semibold transition-all duration-300 ${
                                isActive ? 'opacity-100' : 'opacity-70'
                            }`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
