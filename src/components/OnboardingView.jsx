import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Trophy, Sparkles, Send, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function OnboardingView({ onComplete }) {
    const [phase, setPhase] = useState(0);
    // Phases:
    // 0: Initial black screen, text "Привет. Я Nova."
    // 1: Text "Твой персональный ассистент продуктивности."
    // 2: Text "Давай настроим твою систему."
    // 3: Fog active. Task setup.
    // 4: Fog active. Reward setup.
    // 5: Fog clears. AI Sidebar opens & asks to send a message.
    // 6: AI acknowledges message, completion screen.

    const [fadeState, setFadeState] = useState('in'); // 'in' or 'out'

    // Audio Refs
    const successSound = useRef(new Audio('/sounds/success.mp3'));
    const blipSound = useRef(new Audio('/sounds/blip.mp3'));
    const aiActivateSound = useRef(new Audio('/sounds/ai_activate.mp3'));

    const [taskValue, setTaskValue] = useState('');
    const [rewardValue, setRewardValue] = useState('');
    const [chatValue, setChatValue] = useState(''); // For Phase 5

    const addTask = useStore(state => state.addTask);
    const addReward = useStore(state => state.addReward);
    const addTokens = useStore(state => state.addTokens);
    const completeOnboarding = useStore(state => state.completeOnboarding);

    const playSound = (audioRef) => {
        if (!audioRef.current) return;
        try {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.warn("Audio play blocked or missing:", e));
            }
        } catch (e) {
            console.warn("Audio error:", e);
        }
    };

    // Initial sequence
    useEffect(() => {
        if (phase >= 3) return;

        const sequence = async () => {
            // Phase 0: "Привет. Я Nova."
            setFadeState('in');
            await new Promise(r => setTimeout(r, 2000));
            setFadeState('out');
            await new Promise(r => setTimeout(r, 1000));

            // Phase 1: "Твой персональный ассистент..."
            setPhase(1);
            setFadeState('in');
            await new Promise(r => setTimeout(r, 2500));
            setFadeState('out');
            await new Promise(r => setTimeout(r, 1000));

            // Phase 2: "Давай настроим..."
            setPhase(2);
            setFadeState('in');
            await new Promise(r => setTimeout(r, 2000));
            setFadeState('out');
            await new Promise(r => setTimeout(r, 1000));

            // Go to interactive phase
            setPhase(3);
            setFadeState('in');
        };

        sequence();
    }, []);

    const fireConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#a855f7', '#ec4899', '#ffffff']
        });
    };

    const handleTaskSubmit = (e) => {
        e.preventDefault();
        if (!taskValue.trim()) return;

        addTask(taskValue.trim(), 50);
        addTokens(50, 'Стартовый бонус за первую задачу');
        fireConfetti();
        playSound(successSound);

        setTimeout(() => {
            setPhase(4);
            playSound(blipSound);
            setTaskValue('');
        }, 1500);
    };

    const handleRewardSubmit = (e) => {
        e.preventDefault();
        if (!rewardValue.trim()) return;

        addReward({ title: rewardValue.trim(), cost: 50 });
        addTokens(50, 'Стартовый бонус за первую награду');
        fireConfetti();
        playSound(successSound);

        setTimeout(() => {
            setPhase(5);
            playSound(aiActivateSound);
        }, 1500);
    };

    const handleChatSubmit = (e) => {
        e.preventDefault();
        if (!chatValue.trim()) return;

        playSound(successSound);
        setPhase(6); // Move to final phase
    };

    const handleFinish = () => {

        // Переносим контекст в Дашборд
        const store = useStore.getState();
        store.addChatMessage({
            id: Date.now().toString(),
            role: 'user',
            content: chatValue.trim() || 'Составь план на вечер'
        });
        store.addChatMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Принято! Я подготовила для тебя рабочее пространство. Пройди краткий ознакомительный тур по интерфейсу, и мы сразу вернемся к составлению твоего плана.'
        });

        completeOnboarding();
        // Reset tour state so DashboardTour auto-starts after onboarding
        useStore.getState().setHasSeenTour(false);
        if (onComplete) onComplete();
    };

    // Render Text Phases (0, 1, 2)
    if (phase < 3) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <h1 className={`text-4xl sm:text-5xl md:text-6xl font-black text-white px-6 text-center transition-opacity duration-1000 ${fadeState === 'in' ? 'opacity-100' : 'opacity-0'}`}>
                    {phase === 0 && "Привет. Я Nova."}
                    {phase === 1 && "Твой персональный ассистент продуктивности."}
                    {phase === 2 && "Давай настроим твою систему."}
                </h1>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-bg-primary overflow-y-auto flex flex-col transition-colors duration-1000">
            {/* Background elements to simulate app */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="w-full h-full flex flex-col p-4 sm:p-8 gap-4 sm:gap-8">
                    <div className="w-full h-16 sm:h-24 bg-white/5 rounded-2xl sm:rounded-3xl" />
                    <div className="flex-1 flex gap-4 sm:gap-8">
                        <div className="w-2/3 bg-white/5 rounded-2xl sm:rounded-3xl" />
                        <div className="w-1/3 bg-white/5 rounded-2xl sm:rounded-3xl" />
                    </div>
                </div>
            </div>

            {/* Fog overlay - fades out at phase 5 */}
            <div className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-[2000ms] ${phase < 5 ? 'backdrop-blur-md bg-black/60 opacity-100' : 'opacity-0'}`} />

            {/* Content Container — scrollable, centered but safe from keyboard */}
            <div className={`relative z-20 flex-1 flex items-start sm:items-center justify-center px-4 pt-[18vh] sm:pt-4 pb-8 transition-all duration-1000 ${phase >= 5 ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>

                {/* Phase 3: Task Input */}
                {phase === 3 && (
                    <div className="w-full max-w-lg glass-panel p-6 sm:p-8 animate-fade-in-up flex flex-col items-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                            <Sparkles size={24} className="sm:hidden text-accent animate-pulse" />
                            <Sparkles size={32} className="hidden sm:block text-accent animate-pulse" />
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white text-center mb-2">Напиши свою первую задачу</h2>
                        <p className="text-text-secondary text-center text-sm sm:text-base mb-6 sm:mb-8">Любое небольшое дело. За старт ты получишь +50 очков.</p>

                        <form onSubmit={handleTaskSubmit} className="w-full flex flex-col gap-3">
                            <input
                                autoFocus
                                type="text"
                                value={taskValue}
                                onChange={(e) => setTaskValue(e.target.value)}
                                placeholder="Например: Выпить стакан воды"
                                className="w-full bg-black/50 border-2 border-accent/50 rounded-2xl px-5 py-4 text-base sm:text-lg text-white placeholder:text-text-secondary outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!taskValue.trim()}
                                className="w-full py-4 bg-accent rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-base disabled:opacity-50 hover:bg-accent-hover active:scale-95 transition-all min-h-[48px]"
                            >
                                <Plus size={20} /> Добавить задачу
                            </button>
                        </form>
                    </div>
                )}

                {/* Phase 4: Reward Input */}
                {phase === 4 && (
                    <div className="w-full max-w-lg glass-panel p-6 sm:p-8 animate-fade-in-up flex flex-col items-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-warning/20 flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                            <Trophy size={24} className="sm:hidden text-warning animate-pulse" />
                            <Trophy size={32} className="hidden sm:block text-warning animate-pulse" />
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white text-center mb-2">Отлично!</h2>
                        <p className="text-text-secondary text-center text-sm sm:text-base mb-6 sm:mb-8">А теперь придумай, чем ты себя наградишь за её выполнение.</p>

                        <form onSubmit={handleRewardSubmit} className="w-full flex flex-col gap-3">
                            <input
                                autoFocus
                                type="text"
                                value={rewardValue}
                                onChange={(e) => setRewardValue(e.target.value)}
                                placeholder="Например: 15 минут в ТикТок"
                                className="w-full bg-black/50 border-2 border-warning/50 rounded-2xl px-5 py-4 text-base sm:text-lg text-white placeholder:text-text-secondary outline-none focus:border-warning focus:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!rewardValue.trim()}
                                className="w-full py-4 bg-warning rounded-2xl flex items-center justify-center gap-2 text-black font-bold text-base disabled:opacity-50 hover:bg-yellow-400 active:scale-95 transition-all min-h-[48px]"
                            >
                                <Plus size={20} /> Добавить награду
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* AI Sidebar Phases */}
            {/* Phase 5: AI Learning */}
            {phase === 5 && (
                <div className="absolute right-0 top-0 bottom-0 w-full md:w-[450px] border-l border-white/10 bg-bg-secondary/90 backdrop-blur-3xl shadow-2xl flex flex-col animate-slide-in-right z-[100] pointer-events-auto">
                    <div className="p-6 border-b border-white/5 flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-accent/30 rounded-full blur animate-[pulse_2s_ease-in-out_infinite]" />
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg relative z-10">
                                <Sparkles size={24} className="text-white animate-[spin_4s_linear_infinite]" />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-white tracking-wide">Nova ИИ</h3>
                            <p className="text-xs text-text-secondary flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Ядро онлайн
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                        <div className="glass-panel p-5 rounded-2xl rounded-tr-sm animate-fade-in-up border border-accent/20 bg-accent/5 backdrop-blur-md">
                            <p className="text-white text-sm leading-relaxed mb-4 font-medium">
                                Отличная работа! Я начислила тебе <strong className="text-warning">100 очков</strong> за первичную настройку системы. Твоя задача и награда уже сохранены в базе.
                            </p>
                            <p className="text-white text-sm leading-relaxed">
                                Я твой персональный стратег. Я могу анализировать твои данные, предлагать задачи и помогать с рутиной.
                            </p>
                            <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                <p className="text-accent text-sm font-bold mb-2">Задание на инициализацию:</p>
                                <p className="text-text-secondary text-xs">Попробуй поручить мне свою первую комплексную задачу. Напиши в чат внизу: <br /><strong className="text-white select-all mt-1 inline-block bg-white/10 px-2 py-1 rounded">"Составь план на вечер"</strong></p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-black/40 relative">
                        {/* Animated highlight around the chat input */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-accent via-purple-500 to-accent rounded-xl blur opacity-30 animate-pulse pointer-events-none" />

                        <form onSubmit={handleChatSubmit} className="relative z-10">
                            <input
                                autoFocus
                                type="text"
                                value={chatValue}
                                onChange={(e) => setChatValue(e.target.value)}
                                placeholder="Напиши: Составь план на вечер..."
                                className="w-full bg-black border border-white/10 rounded-xl pl-4 pr-12 py-4 text-sm text-white placeholder:text-text-secondary outline-none focus:border-accent focus:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!chatValue.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-white disabled:opacity-30 disabled:hover:scale-100 hover:scale-105 hover:bg-accent-hover transition-all shadow-[0_4px_10px_rgba(99,102,241,0.3)]"
                            >
                                <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Phase 6: Final Acknowledgement */}
            {phase === 6 && (
                <div className="absolute right-0 top-0 bottom-0 w-full md:w-[450px] border-l border-white/10 bg-bg-secondary/90 backdrop-blur-3xl shadow-2xl flex flex-col animate-slide-in-right z-[100] pointer-events-auto">
                    <div className="p-6 border-b border-white/5 flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg relative z-10">
                                <Sparkles size={24} className="text-white" />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-white tracking-wide">Nova ИИ</h3>
                            <p className="text-xs text-text-secondary flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-success" /> Система готова
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                        {/* User Message sent */}
                        <div className="self-end max-w-[85%] bg-accent/10 border border-accent/20 rounded-2xl p-4 rounded-br-sm animate-fade-in-up">
                            <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">{chatValue}</p>
                        </div>

                        {/* AI Response */}
                        <div className="glass-panel p-5 rounded-2xl rounded-tr-sm animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                            <p className="text-white text-sm leading-relaxed mb-4 font-medium">
                                Принято. Я обработаю этот запрос, как только мы окажемся в главном интерфейсе.
                            </p>
                            <p className="text-text-secondary text-sm">
                                Система полностью настроена, протоколы синхронизированы. Добро пожаловать в будущее твоей продуктивности. 🚀
                            </p>
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/5 bg-black/20">
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleFinish(); }}
                            className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 group relative z-50 pointer-events-auto cursor-pointer"
                        >
                            Войти в Дашборд <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
