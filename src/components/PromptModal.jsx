import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function PromptModal({ isOpen, onClose, onConfirm, title, description, expectedValue, placeholder, confirmText = "Да, удалить", cancelText = "Отмена", icon: Icon = AlertTriangle, danger = true }) {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (expectedValue && inputValue !== expectedValue) {
            setError('Введено неверное значение');
            return;
        }
        onConfirm(inputValue);
        setInputValue('');
        setError('');
        onClose();
    };

    const handleClose = () => {
        setInputValue('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={handleClose}>
            <div className={`bg-bg-secondary border ${danger ? 'border-error/30 shadow-[0_0_40px_rgba(239,68,68,0.15)]' : 'border-warning/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]'} rounded-2xl p-6 max-w-sm w-full animate-scale-in`} onClick={e => e.stopPropagation()}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${danger ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}`}>
                    <Icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
                <p className="text-text-secondary text-sm text-center mb-6" dangerouslySetInnerHTML={{ __html: description }}></p>
                
                <div className="mb-6 relative">
                    <input 
                        type="text" 
                        value={inputValue} 
                        onChange={e => { setInputValue(e.target.value); setError(''); }} 
                        placeholder={placeholder}
                        className={`w-full bg-black/40 border ${error ? 'border-error' : 'border-white/10 focus:border-white/30'} rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-colors`}
                    />
                    {error && <p className="text-xs text-error mt-1.5 absolute -bottom-5 left-0">{error}</p>}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={expectedValue && inputValue !== expectedValue}
                        className={`flex-1 px-4 py-2.5 ${danger ? 'bg-error hover:bg-red-600 shadow-error/20' : 'bg-warning hover:bg-yellow-600 shadow-warning/20'} text-white rounded-xl text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-error`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
