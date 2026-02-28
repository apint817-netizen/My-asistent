import React from 'react';
import useStore from '../store/useStore';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContainer = () => {
    const toasts = useStore(state => state.toasts);
    const removeToast = useStore(state => state.removeToast);

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-xl pointer-events-auto transform transition-all duration-300 animate-slide-up
                    ${toast.type === 'success' ? 'bg-success/10 border-success/30 text-white' :
                            toast.type === 'error' ? 'bg-error/10 border-error/30 text-white' :
                                'bg-bg-secondary/90 border-white/10 text-white'}`}
                >
                    {toast.type === 'success' && <CheckCircle2 className="text-success" size={20} shrink-0 />}
                    {toast.type === 'error' && <XCircle className="text-error" size={20} shrink-0 />}
                    {toast.type === 'info' && <Info className="text-accent" size={20} shrink-0 />}

                    <span className="text-sm font-medium pr-2 flex-1">{toast.message}</span>

                    <button
                        onClick={() => removeToast(toast.id)}
                        className="ml-auto text-white/50 hover:text-white transition-colors p-1 shrink-0"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
