import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, Eye, EyeOff, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AuthView({ onSkip }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const addToast = useStore(state => state.addToast);

    const handleAuth = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            setError('Заполните все поля');
            return;
        }
        if (password.length < 6) {
            setError('Пароль минимум 6 символов');
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (mode === 'register') {
                const { error: signUpError } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                });
                if (signUpError) throw signUpError;
                setSuccess('Проверьте почту для подтверждения аккаунта!');
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (signInError) throw signInError;
                // Auth state listener in App.jsx will handle the redirect
            }
        } catch (err) {
            const msg = err.message || 'Произошла ошибка';
            if (msg.includes('Invalid login')) setError('Неверный email или пароль');
            else if (msg.includes('already registered')) setError('Email уже зарегистрирован');
            else setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider) => {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(`Ошибка авторизации через ${provider}: ${err.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black selection:bg-accent/30 selection:text-white">
            {/* Premium Background Effects */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-black to-black opacity-80" />
            <div className="fixed top-1/4 -left-32 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] animate-pulse pointer-events-none mix-blend-screen" />
            <div className="fixed -bottom-32 -right-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] animate-pulse pointer-events-none mix-blend-screen" style={{ animationDelay: '2s' }} />

            <div className="w-full max-w-md relative z-10 animate-fade-in group">
                <div className="absolute -inset-1 bg-gradient-to-r from-accent/50 to-purple-600/50 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />

                <div className="relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-2xl overflow-hidden">
                    {/* Inner glowing accent */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />

                    {/* Logo Area */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1a1a24] to-[#0a0a0c] border border-white/5 shadow-inner mb-6 relative group-hover:scale-105 transition-transform duration-500">
                            <div className="absolute inset-x-4 inset-y-4 bg-accent/20 rounded-xl blur-lg animate-pulse" />
                            <Sparkles size={36} className="text-accent relative z-10 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        </div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 tracking-tight">Вход в Nova</h1>
                        <p className="text-text-secondary mt-3 font-medium text-sm">Ваша личная операционная система продуктивности</p>
                    </div>

                    {/* Social Auth Buttons */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {/* Telegram */}
                        <button type="button" onClick={() => handleSocialLogin('telegram')} className="flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#2AABEE]/20 hover:border-[#2AABEE]/50 transition-all group/btn">
                            <svg className="w-6 h-6 text-[#2AABEE] group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.08-.19-.09-.05-.21-.02-.3.01-.13.04-2.24 1.43-6.32 4.2-.6.41-1.14.61-1.62.6-.53-.01-1.53-.3-2.28-.54-.91-.3-1.63-.45-1.59-.96.02-.26.34-.53.94-.8 3.7-1.61 6.16-2.67 7.4-3.18 3.52-1.46 4.25-1.72 4.73-1.73.1 0 .34.02.49.14.12.1.18.25.18.42-.01.07-.02.2-.04.35z" />
                            </svg>
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Telegram</span>
                        </button>
                        {/* Google */}
                        <button type="button" onClick={() => handleSocialLogin('google')} className="flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/30 transition-all group/btn">
                            <svg className="w-6 h-6 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="#fff" />
                            </svg>
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Google</span>
                        </button>
                        {/* VK */}
                        <button type="button" onClick={() => handleSocialLogin('vk')} className="flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#0077FF]/20 hover:border-[#0077FF]/50 transition-all group/btn">
                            <svg className="w-6 h-6 text-[#0077FF] group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14.659 18.068c-4.735 0-7.468-3.262-7.56-8.71h2.383c.061 3.99 1.777 5.727 3.12 6.088V9.358h2.261v3.465c1.32-.143 2.723-1.42 3.18-3.465h2.261c-.368 2.502-2.162 4.148-3.262 4.77 1.1.488 3.102 1.944 3.733 4.88h-2.4c-.49-2.072-1.956-3.468-3.243-3.666v3.665h-2.47z" />
                            </svg>
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">ВКонтакте</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">ИЛИ ЧЕРЕЗ EMAIL</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Auth Form */}
                    <form onSubmit={handleAuth} className="space-y-5">
                        <div className="space-y-2 group/input">
                            <label className="text-xs text-text-secondary font-bold tracking-wide uppercase px-1">Email портал</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/input:text-accent transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                    placeholder="commander@nova.ai"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 ext-sm text-white placeholder:text-white/20 outline-none focus:bg-white/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group/input">
                            <label className="text-xs text-text-secondary font-bold tracking-wide uppercase px-1">Код доступа (Пароль)</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/input:text-accent transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-12 py-4 text-sm text-white placeholder:text-white/20 outline-none focus:bg-white/10 focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium animate-fade-in flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="px-4 py-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-medium animate-fade-in flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="relative w-full py-4 mt-2 font-bold text-white rounded-2xl overflow-hidden group/submit transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-accent/20 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-accent via-purple-600 to-accent bg-[length:200%_auto] animate-gradient-x" />
                            <div className="absolute inset-[1px] bg-black/20 rounded-2xl" />
                            <div className="relative flex items-center justify-center gap-2">
                                {loading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : mode === 'login' ? (
                                    <><LogIn size={18} /> Инициализировать Вход</>
                                ) : (
                                    <><UserPlus size={18} /> Создать Личность</>
                                )}
                            </div>
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 flex flex-col items-center gap-4">
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
                            className="text-sm font-semibold text-text-secondary hover:text-white transition-colors"
                        >
                            {mode === 'login' ? 'Нет кода доступа? Регистрация' : 'Уже есть личность? Войти'}
                        </button>

                        {onSkip && (
                            <button
                                onClick={onSkip}
                                className="group flex items-center gap-2 px-4 py-2 mt-2 rounded-full border border-white/5 bg-white/5 text-xs font-medium text-text-secondary hover:bg-white/10 hover:text-white transition-all"
                            >
                                Войти в оффлайн-режим
                                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
