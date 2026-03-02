import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Settings, Bot, X, Link as LinkIcon, Zap, HelpCircle, ChevronDown, Sparkles, Heart, Code, Trash2, User, LogOut } from 'lucide-react';
import { PROXY_MODELS } from '../utils/geminiApi';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function AISettingsModal({ isOpen, onClose }) {
    const apiKey = useStore(state => state.apiKey);
    const setApiKey = useStore(state => state.setApiKey);
    const googleModel = useStore(state => state.googleModel);
    const setGoogleModel = useStore(state => state.setGoogleModel);
    const aiProvider = useStore(state => state.aiProvider);
    const setAiProvider = useStore(state => state.setAiProvider);
    const proxyParams = useStore(state => state.proxyParams);
    const setProxyParams = useStore(state => state.setProxyParams);
    const userProfile = useStore(state => state.userProfile) || { bio: '', goals: '', interests: '' };
    const updateUserProfile = useStore(state => state.updateUserProfile);

    const [tempKey, setTempKey] = useState(apiKey || '');
    const [tempProxy, setTempProxy] = useState(proxyParams);
    const [tempProfile, setTempProfile] = useState(userProfile);
    const [customProxyModel, setCustomProxyModel] = useState(false);
    const [activeSection, setActiveSection] = useState('ai'); // 'ai' | 'profile' | 'about' | 'guide'

    useEffect(() => {
        if (isOpen) {
            setTempKey(apiKey || '');
            setTempProxy(proxyParams);
            setTempProfile(userProfile || { bio: '', goals: '', interests: '' });
        }
    }, [isOpen, apiKey, proxyParams, userProfile]);

    if (!isOpen) return null;

    const saveSettings = (e) => {
        e.preventDefault();
        setApiKey(tempKey.trim());
        setProxyParams(tempProxy);
        updateUserProfile(tempProfile);
        onClose();
    };

    const handleLogout = async () => {
        localStorage.clear();
        if (isSupabaseConfigured()) {
            await supabase.auth.signOut();
        }
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div
                id="tour-settings-modal-override"
                className="glass-panel w-full max-w-2xl max-h-[85vh] overflow-y-auto p-0 relative animate-fade-in custom-scrollbar"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-xl border-b border-border p-6 pb-4 z-10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                            <Settings size={24} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Настройки</h2>
                            <p className="text-text-secondary text-xs">Конфигурация ИИ и информация о сервисе</p>
                        </div>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex flex-wrap bg-black/40 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setActiveSection('ai')}
                            className={`flex flex-1 justify-center items-center gap-2 py-2 px-1 text-xs sm:text-sm rounded-md transition-all font-medium ${activeSection === 'ai' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                        >
                            <Bot size={14} /> ИИ
                        </button>
                        <button
                            onClick={() => setActiveSection('profile')}
                            className={`flex flex-1 justify-center items-center gap-2 py-2 px-1 text-xs sm:text-sm rounded-md transition-all font-medium ${activeSection === 'profile' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                        >
                            <User size={14} /> Профиль
                        </button>
                        <button
                            onClick={() => setActiveSection('guide')}
                            className={`flex flex-1 justify-center items-center gap-2 py-2 px-1 text-xs sm:text-sm rounded-md transition-all font-medium ${activeSection === 'guide' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                        >
                            <HelpCircle size={14} /> Гайд
                        </button>
                        <button
                            onClick={() => setActiveSection('about')}
                            className={`flex flex-1 justify-center items-center gap-2 py-2 px-1 text-xs sm:text-sm rounded-md transition-all font-medium ${activeSection === 'about' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                        >
                            <Heart size={14} /> О сервисе
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* ===== AI Settings Section ===== */}
                    {activeSection === 'ai' && (
                        <div className="space-y-5 animate-fade-in">
                            {/* Provider Toggle */}
                            <div>
                                <label className="text-sm text-text-secondary font-medium block mb-2">Провайдер ИИ</label>
                                <div className="flex bg-black/40 rounded-lg p-1">
                                    <button
                                        onClick={() => setAiProvider('google')}
                                        className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm rounded-md transition-all font-medium ${aiProvider === 'google' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                                    >
                                        <Bot size={16} />
                                        Google Gemini
                                    </button>
                                    <button
                                        onClick={() => setAiProvider('proxy')}
                                        className={`flex-1 flex justify-center items-center gap-2 py-2.5 text-sm rounded-md transition-all font-medium ${aiProvider === 'proxy' ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-white'}`}
                                    >
                                        <LinkIcon size={16} />
                                        Локальный Прокси
                                    </button>
                                </div>
                            </div>

                            {/* Provider Badge */}
                            <div className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${aiProvider === 'google' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                <Zap size={12} />
                                {aiProvider === 'google' ? 'Бесплатно — лимиты Google AI Studio' : 'Расход токенов с аккаунта прокси'}
                            </div>

                            <form onSubmit={saveSettings} className="space-y-4">
                                {aiProvider === 'google' ? (
                                    <div className="space-y-4 animate-fade-in">
                                        {/* Server Key Notification */}
                                        <div className="bg-white/5 border border-border/50 rounded-lg p-4 text-sm text-text-secondary flex items-start gap-3">
                                            <div className="mt-0.5"><Zap size={16} className="text-accent" /></div>
                                            <div>
                                                <p className="font-bold text-white mb-1">Ключ настроен на сервере</p>
                                                <p className="text-xs leading-relaxed">Вам не нужно вводить ключ здесь. Запросы к Google Gemini безопасно отправляются с серверов Vercel, обходя региональные блокировки.</p>
                                            </div>
                                        </div>
                                        {/* Auto Model Info */}
                                        <div className="bg-black/20 border border-border/50 rounded-lg p-4 text-sm text-text-secondary flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                                                <Bot size={18} className="text-accent" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white mb-0.5">Умный выбор модели</p>
                                                <p className="text-xs leading-relaxed">Система автоматически сканирует доступные модели Google (Flash, Pro) и выбирает самую мощную из работающих в данный момент.</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-fade-in">
                                        {/* Proxy URL */}
                                        <div className="space-y-1">
                                            <label className="text-sm text-text-secondary font-medium block">🔗 Proxy URL</label>
                                            <input
                                                type="text"
                                                placeholder="http://127.0.0.1:8045/v1"
                                                className="w-full bg-black/40 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                                value={tempProxy.url}
                                                onChange={(e) => setTempProxy({ ...tempProxy, url: e.target.value })}
                                            />
                                        </div>
                                        {/* Proxy API Key */}
                                        <div className="space-y-1">
                                            <label className="text-sm text-text-secondary font-medium block">🔑 API Key</label>
                                            <input
                                                type="password"
                                                placeholder="sk-..."
                                                className="w-full bg-black/40 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                                value={tempProxy.key}
                                                onChange={(e) => setTempProxy({ ...tempProxy, key: e.target.value })}
                                            />
                                        </div>
                                        {/* Proxy Model Select */}
                                        <div className="space-y-1">
                                            <label className="text-sm text-text-secondary font-medium block">📋 Модель</label>
                                            {!customProxyModel ? (
                                                <>
                                                    <select
                                                        className="w-full bg-black/40 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer appearance-none"
                                                        value={tempProxy.model}
                                                        onChange={(e) => {
                                                            if (e.target.value === '__custom__') {
                                                                setCustomProxyModel(true);
                                                                setTempProxy({ ...tempProxy, model: '' });
                                                            } else {
                                                                setTempProxy({ ...tempProxy, model: e.target.value });
                                                            }
                                                        }}
                                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                                                    >
                                                        {PROXY_MODELS.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
                                                        ))}
                                                        <option value="__custom__">✏️ Ввести вручную...</option>
                                                    </select>
                                                </>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Введите название модели..."
                                                        className="flex-1 bg-black/40 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                                        value={tempProxy.model}
                                                        onChange={(e) => setTempProxy({ ...tempProxy, model: e.target.value })}
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustomProxyModel(false)}
                                                        className="px-3 py-2 bg-black/40 border border-border rounded-md text-xs text-text-secondary hover:text-white transition-colors"
                                                    >
                                                        Список
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button type="submit" className="w-full bg-accent text-white px-4 py-3 mt-4 rounded-xl text-sm hover:bg-accent-hover transition-colors font-semibold shadow-lg shadow-accent/20">
                                    Сохранить настройки
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ===== Profile Section ===== */}
                    {activeSection === 'profile' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-text-secondary flex items-start gap-3">
                                <User size={16} className="text-blue-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-white mb-1">О вас</p>
                                    <p className="text-xs leading-relaxed">Заполните эти поля, чтобы ИИ лучше понимал ваш контекст, ваши интересы и глобальные цели при планировании. Эти данные передаются в системный промпт помощника.</p>
                                </div>
                            </div>

                            <form onSubmit={saveSettings} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm text-text-secondary font-medium block">ℹ️ Краткое био / Кто вы</label>
                                    <textarea
                                        placeholder="Напр.: Я QA Engineer уровня Middle, люблю автоматизацию на Python, но сейчас выгораю от рутины..."
                                        className="w-full bg-black/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none h-20"
                                        value={tempProfile.bio}
                                        onChange={(e) => setTempProfile({ ...tempProfile, bio: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-text-secondary font-medium block">🎯 Главные цели (на квартал/год)</label>
                                    <textarea
                                        placeholder="Напр.: 1. Выйти на доход 300к. 2. Прочитать 12 книг по процессам. 3. Начать бегать."
                                        className="w-full bg-black/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none h-20"
                                        value={tempProfile.goals}
                                        onChange={(e) => setTempProfile({ ...tempProfile, goals: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-text-secondary font-medium block">⭐ Интересы и хобби (в качестве наград)</label>
                                    <textarea
                                        placeholder="Напр.: Люблю играть в Доту 2, заказывать пиццу Пепперони, гулять по лесу, смотреть аниме."
                                        className="w-full bg-black/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none h-20"
                                        value={tempProfile.interests}
                                        onChange={(e) => setTempProfile({ ...tempProfile, interests: e.target.value })}
                                    />
                                </div>
                                <button type="submit" className="w-full bg-accent text-white px-4 py-3 mt-4 rounded-xl text-sm hover:bg-accent-hover transition-colors font-semibold shadow-lg shadow-accent/20">
                                    Сохранить профиль
                                </button>
                            </form>

                            <div className="pt-4 border-t border-white/5">
                                <button
                                    onClick={handleLogout}
                                    className="w-full bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 px-4 py-3 rounded-xl text-sm transition-colors font-semibold shadow-lg shadow-danger/5 flex items-center justify-center gap-2"
                                >
                                    <LogOut size={16} /> Выйти из аккаунта
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== Guide Section ===== */}
                    {activeSection === 'guide' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-accent/5 border border-accent/20 rounded-xl p-5">
                                <h3 className="font-bold text-accent mb-3 flex items-center gap-2">
                                    <Code size={18} /> Подключение Локального Прокси
                                </h3>
                                <div className="space-y-3 text-sm text-text-secondary">
                                    <p><strong className="text-white">1.</strong> Перейдите в <strong className="text-white">Настройки ИИ</strong> (вкладка слева) и выберите <strong className="text-white">Локальный Прокси</strong></p>
                                    <p><strong className="text-white">2.</strong> Укажите адрес прокси-сервера (напр. <code className="text-accent bg-accent/10 px-1.5 py-0.5 rounded">http://127.0.0.1:8045/v1</code>)</p>
                                    <p><strong className="text-white">3.</strong> Введите API ключ от вашего прокси-аккаунта</p>
                                    <p><strong className="text-white">4.</strong> Выберите модель из списка или введите название вручную</p>
                                    <p><strong className="text-white">5.</strong> Нажмите <strong className="text-white">Сохранить настройки</strong></p>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-border/50 rounded-xl p-4 text-sm text-text-secondary flex items-start gap-3">
                                <Zap size={16} className="text-accent mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-white mb-1">Google Gemini</p>
                                    <p className="text-xs leading-relaxed">Подключён автоматически через сервер. Вам не нужно ничего настраивать — просто используйте сервис.</p>
                                </div>
                            </div>

                            <p className="text-[11px] text-text-secondary/60 text-center">Все данные настроек хранятся локально в вашем браузере (localStorage).</p>
                        </div>
                    )}

                    {/* ===== About Section ===== */}
                    {activeSection === 'about' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="text-center mb-2">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/30 to-accent-hover/30 border border-accent/30 mb-3">
                                    <Sparkles size={32} className="text-accent" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Ассистент Nova</h3>
                                <p className="text-text-secondary text-sm mt-1">Ваш персональный ИИ-ассистент для саморазвития</p>
                            </div>

                            <div className="bg-bg-primary/50 border border-border rounded-xl p-5 space-y-3">
                                <h4 className="font-semibold text-white">🎯 Для чего этот сервис?</h4>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Nova помогает вам выстроить систему привычек и целей через геймификацию.
                                    Выполняйте задачи, зарабатывайте очки, обменивайте их на награды — и наблюдайте,
                                    как ваша продуктивность растёт день за днём.
                                </p>
                            </div>

                            <div className="bg-bg-primary/50 border border-border rounded-xl p-5 space-y-3">
                                <h4 className="font-semibold text-white">🧠 Возможности ИИ</h4>
                                <ul className="text-sm text-text-secondary space-y-2">
                                    <li className="flex items-start gap-2"><span className="text-accent">•</span> <span>Чат-ассистент Nova — мотивирует, советует, помогает с планированием</span></li>
                                    <li className="flex items-start gap-2"><span className="text-accent">•</span> <span>Стратег Nova (Анализ) — проводит интервью и составляет расписание</span></li>
                                    <li className="flex items-start gap-2"><span className="text-accent">•</span> <span>Автоматический подбор лучшей модели Google Gemini</span></li>
                                </ul>
                            </div>

                            <div className="bg-bg-primary/50 border border-border rounded-xl p-5 space-y-3">
                                <h4 className="font-semibold text-white">👨‍💻 Кем создан</h4>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    Разработано с использованием React, Vite и Google Gemini AI.
                                    Развёрнуто на платформе Vercel.
                                </p>
                            </div>

                            <p className="text-[11px] text-text-secondary/60 text-center">Версия 2.1 • 2026</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
