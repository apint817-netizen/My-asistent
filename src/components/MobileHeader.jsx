import React, { useState, useEffect } from 'react';
import { Activity, Settings, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../store/useStore';
import { isSoundEnabled, toggleSound, playHoverSound } from '../utils/sound';

export default function MobileHeader({ onShowSettings, onShowPointsHistory }) {
    const tokens = useStore(state => state.tokens);
    const streak = useStore(state => state.streak);
    const [soundOn, setSoundOn] = useState(isSoundEnabled());

    const handleToggleSound = () => {
        toggleSound();
        setSoundOn(isSoundEnabled());
    };

    return (
        <header 
            className="flex items-center justify-between px-4 shrink-0 bg-bg-primary border-b border-white/5 z-50 pt-[max(env(safe-area-inset-top),12px)] pb-3"
            style={{ minHeight: 'calc(56px + env(safe-area-inset-top, 0px))' }}
        >
            {/* Left: Logo + Streak */}
            <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-bold text-gradient tracking-tight whitespace-nowrap">Nova</h1>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs font-semibold rounded-full border border-success/20 shrink-0">
                    <Activity size={12} />
                    {streak}дн.
                </span>
            </div>

            {/* Right: Sound toggle + Points + Settings */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handleToggleSound}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border ${soundOn ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-white/5 border-border text-text-secondary'}`}
                    title={soundOn ? 'Выключить звук' : 'Включить звук'}
                >
                    {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                    onClick={onShowPointsHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-full active:bg-warning/20 transition-colors"
                >
                    <Trophy size={14} className="text-warning" />
                    <span className="text-sm font-bold text-warning">{tokens}</span>
                </button>
                <button
                    onClick={onShowSettings}
                    onMouseEnter={playHoverSound}
                    className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center text-text-secondary active:bg-white/10 transition-colors"
                >
                    <Settings size={18} />
                </button>
            </div>
        </header>
    );
}
