import React from 'react';
import { Activity, Settings, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function MobileHeader({ onShowSettings, onShowPointsHistory }) {
    const tokens = useStore(state => state.tokens);
    const streak = useStore(state => state.streak);

    return (
        <header className="flex items-center justify-between h-14 px-4 shrink-0">
            {/* Left: Logo + Streak */}
            <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-bold text-gradient tracking-tight whitespace-nowrap">Nova</h1>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs font-semibold rounded-full border border-success/20 shrink-0">
                    <Activity size={12} />
                    {streak}дн.
                </span>
            </div>

            {/* Right: Points + Settings */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onShowPointsHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-full active:bg-warning/20 transition-colors"
                >
                    <Trophy size={14} className="text-warning" />
                    <span className="text-sm font-bold text-warning">{tokens}</span>
                </button>
                <button
                    onClick={onShowSettings}
                    className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center text-text-secondary active:bg-white/10 transition-colors"
                >
                    <Settings size={18} />
                </button>
            </div>
        </header>
    );
}
