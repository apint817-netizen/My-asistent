import React from 'react';
import { Trash2 } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, description, confirmText = "Да, удалить", cancelText = "Отмена", icon: Icon = Trash2, danger = true }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className={`bg-bg-secondary border ${danger ? 'border-error/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]' : 'border-warning/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]'} rounded-2xl p-6 max-w-sm w-full animate-scale-in`} onClick={e => e.stopPropagation()}>
                <div className={`w-12 h-12 rounded-full ${danger ? 'bg-error/20' : 'bg-warning/20'} flex items-center justify-center mb-4 mx-auto`}>
                    <Icon size={24} className={danger ? 'text-error' : 'text-warning'} />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
                <p className="text-text-secondary text-sm text-center mb-6" dangerouslySetInnerHTML={{ __html: description }}></p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-4 py-2.5 ${danger ? 'bg-error hover:bg-red-600 shadow-error/20' : 'bg-warning hover:bg-yellow-600 shadow-warning/20'} text-white rounded-xl text-sm font-bold transition-colors shadow-lg`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
