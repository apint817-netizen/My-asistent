import React, { useState } from 'react';
import { FileText, BarChart3, Brain, Settings, HelpCircle, LogOut, ChevronRight, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import ResumeView from './ResumeView';

export default function ProfileView({ user, onLogout, onShowAISettings, onShowHelp, onShowPointsHistory, onShowAnalysis }) {
    const [activeSection, setActiveSection] = useState(null);
    const tokens = useStore(state => state.tokens);

    // If a section is active, show it fullscreen
    if (activeSection === 'resume') {
        return (
            <div className="flex flex-col flex-1 min-h-0 animate-fade-in">
                <button
                    onClick={() => setActiveSection(null)}
                    className="flex items-center gap-2 text-sm text-text-secondary mb-4 active:text-white transition-colors self-start"
                >
                    ← Назад
                </button>
                <ResumeView />
            </div>
        );
    }

    const menuItems = [
        { id: 'resume', icon: FileText, label: 'Резюме и карьера', color: 'text-emerald-400', action: () => setActiveSection('resume') },
        { id: 'points', icon: BarChart3, label: 'История очков', color: 'text-warning', action: onShowPointsHistory },
        { id: 'analysis', icon: Brain, label: 'Анализ плана', color: 'text-indigo-400', action: onShowAnalysis },
        { id: 'settings', icon: Settings, label: 'Настройки ИИ', color: 'text-accent', action: onShowAISettings },
        { id: 'help', icon: HelpCircle, label: 'Справка', color: 'text-blue-400', action: onShowHelp },
    ];

    return (
        <div className="flex flex-col gap-4 animate-fade-in max-w-md w-full mx-auto">
            {/* User card */}
            <div className="glass-panel p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/40 to-accent-hover/40 border border-accent/30 flex items-center justify-center text-white shrink-0">
                    <User size={28} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base truncate">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Пользователь'}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-bold text-warning">⚡ {tokens}</span>
                        <span className="text-xs text-text-secondary">очков</span>
                    </div>
                </div>
            </div>

            {/* Menu list */}
            <div className="glass-panel overflow-hidden divide-y divide-white/5">
                {menuItems.map(item => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:bg-white/5"
                        >
                            <Icon size={20} className={item.color} />
                            <span className="flex-1 text-sm font-medium text-white">{item.label}</span>
                            <ChevronRight size={16} className="text-text-secondary/50" />
                        </button>
                    );
                })}
            </div>

            {/* Logout */}
            {user && (
                <button
                    onClick={onLogout}
                    className="glass-panel flex items-center gap-4 px-5 py-4 text-left transition-colors active:bg-danger/10 w-full"
                >
                    <LogOut size={20} className="text-danger/70" />
                    <span className="text-sm font-medium text-danger/70">Выйти из аккаунта</span>
                </button>
            )}
        </div>
    );
}
