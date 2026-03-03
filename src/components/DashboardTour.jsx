import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Target, Sparkles, Navigation, X } from 'lucide-react';

// Tour steps definition. Every step strictly defines the EXACT state of the entire UI needed for it.
const steps = [
    {
        targetId: 'tour-header',
        title: '👋 Добро пожаловать в Ассистент Nova!',
        content: 'Это твоя персональная система продуктивности с ИИ-ментором. Давай проведём короткий обзор — я покажу, как извлечь максимум пользы.',
        position: 'bottom',
        action: (store) => {
            store.setActiveTab('dashboard');
            store.setIsRewardStoreOpen(false);
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
            store.setTourDemoAIText('');
            store.setTourDemoTaskText('');
        }
    },
    {
        targetId: 'tour-summary',
        title: 'Управление Вкладками',
        content: 'Это твой пульт управления. Переключайся между текущими задачами, календарем на неделю и загрузкой резюме.',
        position: 'bottom',
        action: (store) => {
            store.setActiveTab('dashboard');
            store.setIsRewardStoreOpen(false);
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
        }
    },
    {
        targetId: 'tour-calendar-tab',
        title: 'Долгосрочное Планирование',
        content: 'Во вкладке "Календарь" ты можешь распределять нагрузку по дням, чтобы не перегореть.',
        position: 'bottom',
        action: (store) => {
            store.setActiveTab('calendar');
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
        }
    },
    {
        targetId: 'tour-resume-tab',
        title: 'Персональный План от ИИ',
        content: 'Вкладка "Резюме" позволяет загрузить описание твоего проекта или карьеры, а я составлю подробный план достижения.',
        position: 'bottom',
        action: (store) => {
            store.setActiveTab('resume');
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
        }
    },
    {
        targetId: 'tour-add-task',
        title: 'Добавление Задач',
        content: 'Впиши задачу и выбери ее сложность. Чем сложнее задача, тем больше очков-топлива ты получишь при выполнении.',
        position: 'top',
        action: (store) => {
            store.setActiveTab('dashboard');
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
            store.setTourDemoTaskText('');

            // Simulate typing effect
            const text = 'Сделать зарядку...';
            let current = '';
            for (let i = 0; i < text.length; i++) {
                setTimeout(() => {
                    current += text[i];
                    store.setTourDemoTaskText(current);
                }, 600 + (i * 70));
            }
        }
    },
    {
        targetId: 'tour-task-list',
        title: 'Трекинг Прогресса',
        content: 'Выполняй задачи для заработка баллов. Удерживай задачи для изменения порядка, или удаляй их, если они потеряли актуальность.',
        position: 'right',
        action: (store) => {
            store.setTourDemoTaskText('');
            store.setShowAnalysisModal(false);
        }
    },
    {
        targetId: 'tour-analysis-btn',
        title: 'Стратегический Анализ',
        content: 'Застрял или не знаешь с чего начать? Кликни сюда, и я проведу глубокий стратегический разбор твоего плана.',
        position: 'center',
        action: (store) => {
            store.setIsRewardStoreOpen(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
            store.setShowAnalysisModal(true);
        }
    },
    {
        targetId: 'tour-rewards',
        title: 'Магазин Дофамина',
        content: 'Трать заработанные баллы на то, что приносит радость. Вознаграждай себя за труд без чувства вины.',
        position: 'right',
        action: (store) => {
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
            store.setIsRewardStoreOpen(true);
        }
    },
    {
        targetId: 'tour-ai',
        title: 'Ядро ИИ',
        content: 'Твой ментор 24/7. Советуйся со мной, проси изменить список задач или просто делись мыслями.',
        position: 'left',
        action: (store) => {
            store.setIsRewardStoreOpen(false);
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(false);
            store.setTourDemoAIText('');

            // Simulate typing effect
            const text = 'Оптимизируй мой план...';
            let current = '';
            for (let i = 0; i < text.length; i++) {
                setTimeout(() => {
                    current += text[i];
                    store.setTourDemoAIText(current);
                }, 600 + (i * 70));
            }
        }
    },
    {
        targetId: 'tour-points',
        title: 'Твой Баланс',
        content: 'Здесь отображается твое текущее топливо. Кликай, чтобы посмотреть подробную историю начислений и списаний.',
        position: 'center',
        action: (store) => {
            store.setTourDemoAIText('');
            store.setShowAnalysisModal(false);
            store.setShowAISettings(false);
            store.setShowPointsHistory(true);
        }
    },
    {
        targetId: 'tour-settings',
        title: 'Настройки ИИ',
        content: 'Настройте мой характер, выберите модель и управляйте профилем.',
        position: 'center',
        action: (store) => {
            store.setTourDemoAIText('');
            store.setShowAnalysisModal(false);
            store.setShowPointsHistory(false);
            store.setShowAISettings(true);
        }
    }
];

export default function DashboardTour() {
    const hasSeenTour = useStore(state => state.hasSeenTour);
    const completeTour = useStore(state => state.completeTour);

    const [currentStep, setCurrentStep] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [targetRect, setTargetRect] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);

    // Show prompt (not auto-start tour) if not seen
    useEffect(() => {
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [hasSeenTour]);

    const startTour = () => {
        setShowPrompt(false);
        setIsActive(true);
        setCurrentStep(0);
        updateSpotlight(steps[0].targetId);
    };

    const skipTour = () => {
        setShowPrompt(false);
        completeTour();
    };

    // Handle resize and scroll
    useEffect(() => {
        if (!isActive) return;

        const handleUpdate = () => {
            updateSpotlight(steps[currentStep].targetId);
        };

        window.addEventListener('resize', handleUpdate);
        window.addEventListener('scroll', handleUpdate, true);

        return () => {
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
        };
    }, [isActive, currentStep]);

    // Handle dynamic step actions
    useEffect(() => {
        if (!isActive) return;

        const step = steps[currentStep];
        if (step.action) {
            step.action(useStore.getState());
        }

        const timer = setTimeout(() => {
            let finalTargetId = step.targetId;
            const state = useStore.getState();

            if (step.targetId === 'tour-analysis-btn' && state.showAnalysisModal) {
                finalTargetId = 'tour-analysis-btn-modal-override';
            } else if (step.targetId === 'tour-points' && state.showPointsHistory) {
                finalTargetId = 'tour-points-modal-override';
            } else if (step.targetId === 'tour-settings' && state.showAISettings) {
                finalTargetId = 'tour-settings-modal-override';
            }

            updateSpotlight(finalTargetId);
        }, 500);

        return () => clearTimeout(timer);
    }, [isActive, currentStep]);

    const updateSpotlight = (id) => {
        const el = document.getElementById(id);
        if (el) {
            const rect = el.getBoundingClientRect();
            setTargetRect({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            });
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setTargetRect(null);
        }
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            const audio = new Audio('/sounds/ui_select.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });

            setCurrentStep(prev => prev + 1);
            // Target spotlight update is handled by the useEffect watching currentStep
        } else {
            endTour();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            const audio = new Audio('/sounds/ui_select.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });

            setCurrentStep(prev => prev - 1);
            // Target spotlight update is handled by the useEffect watching currentStep
        }
    };

    const endTour = () => {
        const audio = new Audio('/sounds/success.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => { });

        setIsActive(false);
        const store = useStore.getState();
        store.setShowAISettings(false);
        store.setShowPointsHistory(false);
        store.setShowAnalysisModal(false);
        store.setIsRewardStoreOpen(true);
        store.setActiveTab('dashboard');
        // Clear demo text to unblock Nova input
        store.setTourDemoAIText('');
        store.setTourDemoTaskText('');

        completeTour();
    };

    // Render Nova prompt if tour hasn't been seen
    if (showPrompt && !isActive) {
        return (
            <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel border-2 border-accent/40 bg-bg-secondary/95 p-8 max-w-md w-full mx-4 shadow-[0_0_60px_rgba(99,102,241,0.3)] animate-scale-in">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-accent/30 rounded-full blur animate-[pulse_2s_ease-in-out_infinite]" />
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg relative z-10">
                                <Sparkles size={28} className="text-white" />
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-accent font-bold uppercase tracking-wider">Nova OS</span>
                            <h3 className="font-bold text-white text-xl">Экскурсия по интерфейсу</h3>
                        </div>
                    </div>
                    <p className="text-text-secondary text-sm leading-relaxed mb-8">
                        Хочешь, я проведу тебе короткую экскурсию? Я покажу все ключевые функции и расскажу, как извлечь максимум из системы. Займёт пару минут.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={skipTour}
                            className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white font-medium rounded-xl text-sm transition-all"
                        >
                            Пропустить
                        </button>
                        <button
                            onClick={startTour}
                            className="flex-1 px-5 py-3 bg-white text-black font-bold rounded-xl text-sm hover:scale-[1.02] transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-2"
                        >
                            <Sparkles size={16} /> Да, давай!
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isActive || !targetRect) return null;

    const step = steps[currentStep];

    // Calculate tooltip position
    let tooltipStyle = {};
    const PADDING = 20;

    if (step.position === 'bottom') {
        tooltipStyle = { top: targetRect.top + targetRect.height + PADDING, left: targetRect.left };
    } else if (step.position === 'top') {
        tooltipStyle = { bottom: window.innerHeight - targetRect.top + PADDING, left: targetRect.left };
    } else if (step.position === 'right') {
        tooltipStyle = { top: targetRect.top, left: targetRect.left + targetRect.width + PADDING };
    } else if (step.position === 'left') {
        tooltipStyle = { top: targetRect.top, right: window.innerWidth - targetRect.left + PADDING };
    } else if (step.position === 'center') {
        tooltipStyle = {
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)'
        };
    }

    // Adjust for small screens
    if (window.innerWidth < 768) {
        tooltipStyle = {
            position: 'fixed',
            bottom: '20px',
            left: '16px',
            right: '16px',
            width: 'auto',
            zIndex: 100000
        };
    }

    return (
        <div className="fixed inset-0 z-[99990] pointer-events-auto">
            {/* Dimmed background using box-shadow around an empty div overlaying the exact target */}
            <div
                className="fixed pointer-events-none transition-all duration-700 ease-out z-[99990]"
                style={{
                    top: targetRect.top - 8,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 30px rgba(99, 102, 241, 0.4)',
                    borderRadius: '16px',
                    border: '2px solid rgba(99, 102, 241, 0.5)'
                }}
            >
                <div className="absolute inset-0 rounded-2xl animate-[pulse_2s_ease-in-out_infinite] border border-accent/30" />
            </div>

            {/* Tooltip Content */}
            <div
                className="absolute w-auto sm:min-w-[320px] sm:max-w-[420px] lg:max-w-[500px] glass-panel border-2 border-accent/60 bg-bg-secondary/95 p-4 sm:p-6 animate-fade-in-up shadow-[0_0_40px_rgba(99,102,241,0.5)] z-[99995]"
                style={tooltipStyle}
            >
                <button
                    onClick={endTour}
                    className="absolute top-3 right-3 text-text-secondary hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg">
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                        <span className="text-xs text-accent font-bold uppercase tracking-wider">Nova OS</span>
                        <h3 className="font-bold text-white text-lg leading-tight">{step.title}</h3>
                    </div>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed mb-6">
                    {step.content}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex gap-1.5 justify-center sm:justify-start">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-accent' : 'w-2 bg-white/20'}`}
                            />
                        ))}
                    </div>

                    <div className="flex gap-2 relative z-10 justify-end">
                        <button
                            onClick={endTour}
                            className="px-3 sm:px-4 py-2 whitespace-nowrap text-text-secondary hover:text-white text-xs sm:text-sm font-medium transition-colors"
                        >
                            Пропустить
                        </button>
                        {currentStep > 0 && (
                            <button
                                onClick={handlePrev}
                                className="px-3 sm:px-5 py-2 whitespace-nowrap bg-white/10 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-white/20 transition-colors flex items-center"
                            >
                                Назад
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-4 sm:px-5 py-2 whitespace-nowrap bg-white text-black font-bold rounded-xl text-xs sm:text-sm hover:scale-105 transition-transform flex items-center gap-1 sm:gap-2"
                        >
                            {currentStep === steps.length - 1 ? 'Начать' : 'Далее'}
                            <Navigation size={14} className="rotate-90" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
