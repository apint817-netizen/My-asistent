import React from 'react';
import { X } from 'lucide-react';
import AnalysisView from './AnalysisView';

export default function AnalysisModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in bg-black/60 backdrop-blur-md">
            <div id="tour-analysis-btn-modal-override" className="bg-[#0a0a0a] border border-border rounded-2xl w-full max-w-[1200px] h-[90vh] shadow-2xl flex flex-col relative overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-black/40 hover:bg-white/10 text-text-secondary hover:text-white transition-colors border border-border shadow-lg"
                    aria-label="Закрыть"
                >
                    <X size={20} />
                </button>
                <div className="w-full h-full overflow-y-auto custom-scrollbar p-6 pt-16">
                    <AnalysisView inModal={true} />
                </div>
            </div>
        </div>
    );
}
