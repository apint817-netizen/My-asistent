import React from 'react';
import { useStore } from '../store/useStore';
import { X, Target, Trophy, Calendar, Brain, Settings, Sparkles } from 'lucide-react';

const sections = [
    {
        icon: <Target size={24} className="text-accent" />,
        title: 'Цели и Привычки',
        emoji: '🎯',
        description: 'Добавляйте задачи на сегодня и отмечайте выполненные. За каждую выполненную цель вы получаете очки, которые можно обменять на награды.',
        color: 'accent'
    },
    {
        icon: <Trophy size={24} className="text-warning" />,
        title: 'Магазин Наград',
        emoji: '🏆',
        description: 'Обменивайте заработанные очки на приятности: отдых, любимую еду, игры. Вы сами настраиваете список наград и их стоимость.',
        color: 'warning'
    },
    {
        icon: <Calendar size={24} className="text-blue-400" />,
        title: 'Календарь',
        emoji: '📅',
        description: 'Планируйте задачи на будущие дни. Видите нагрузку по дням и распределяйте силы, чтобы не выгореть.',
        color: 'blue-400'
    },
    {
        icon: <Brain size={24} className="text-purple-400" />,
        title: 'Анализ (Стратег Nova)',
        emoji: '🧠',
        description: 'ИИ-стратег проведёт с вами интервью о ваших целях и долгах, а затем составит черновик расписания. Вы утверждаете план одной кнопкой.',
        color: 'purple-400'
    },
    {
        icon: <Settings size={24} className="text-text-secondary" />,
        title: 'Настройки ИИ',
        emoji: '⚙️',
        description: 'Подключите Google Gemini (бесплатный ключ из AI Studio) или используйте свой локальный прокси-сервер. Инструкция — внутри настроек чата.',
        color: 'text-secondary'
    }
];

export default function HelpView({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div
                className="glass-panel w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8 relative animate-fade-in custom-scrollbar"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-all"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 mb-4">
                        <Sparkles size={32} className="text-accent" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Как пользоваться Ассистентом Nova</h2>
                    <p className="text-text-secondary text-sm">Краткое руководство по всем разделам приложения</p>
                </div>

                <div className="space-y-4">
                    {sections.map((section, i) => (
                        <div
                            key={i}
                            className="bg-bg-primary/50 border border-border rounded-xl p-5 flex gap-4 items-start hover:border-accent/30 transition-colors group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center shrink-0 text-2xl group-hover:scale-110 transition-transform">
                                {section.emoji}
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-1">{section.title}</h3>
                                <p className="text-sm text-text-secondary leading-relaxed">{section.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                            setTimeout(() => {
                                useStore.getState().setHasSeenTour(false);
                            }, 50);
                        }}
                        className="px-6 py-2.5 bg-white/10 text-white rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} className="text-accent" />
                        Перезапустить обучение
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
                    >
                        Понятно, закрыть
                    </button>
                </div>
            </div>
        </div>
    );
}
