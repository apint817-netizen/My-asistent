import React, { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import AIAssistant from './AIAssistant';

export default function NovaFAB() {
    const [isOpen, setIsOpen] = useState(false);

    // Prevent body scroll when chat is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    return (
        <>
            {/* FAB Button — visible only on mobile, hidden when chat is open */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="lg:hidden fixed z-40 w-14 h-14 rounded-full bg-accent shadow-xl shadow-accent/30 flex items-center justify-center text-white transition-transform active:scale-95 hover:bg-accent-hover"
                    style={{
                        right: '16px',
                        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 68px)',
                    }}
                    aria-label="Открыть Nova"
                >
                    <MessageSquare size={24} />
                </button>
            )}

            {/* Fullscreen AI Chat Overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-[60] bg-bg-primary flex flex-col animate-slide-up"
                >
                    {/* Chat header with back button */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-primary/95 backdrop-blur-sm" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center text-text-secondary active:bg-white/10 transition-colors shrink-0"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center border border-accent/50 shrink-0">
                                <MessageSquare size={16} className="text-white" />
                            </div>
                            <span className="font-bold text-white text-base">Nova</span>
                        </div>
                    </div>

                    {/* AI Assistant fills remaining space */}
                    <div className="flex-1 overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                        <AIAssistant />
                    </div>
                </div>
            )}
        </>
    );
}
