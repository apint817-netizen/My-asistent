import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, Eye, EyeOff, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AuthView() {
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
                            <svg className="w-6 h-6 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Google</span>
                        </button>
                        {/* VK */}
                        <button type="button" onClick={() => handleSocialLogin('vk')} className="flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-[#0077FF]/20 hover:border-[#0077FF]/50 transition-all group/btn">
                            <svg className="w-6 h-6 group-hover/btn:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path d="M12.785 16.241s.288-.032.436-.192c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.19 1.364 1.259 2.178 1.815.616.42 1.084.328 1.084.328l2.175-.03s1.138-.07.598-.964c-.044-.073-.314-.661-1.618-1.869-1.366-1.263-1.183-1.059.462-3.245.756-1.003 1.303-1.957 1.221-2.22-.076-.244-.553-.18-.553-.18l-2.448.015s-.182-.025-.316.056c-.132.079-.218.262-.218.262s-.389 1.037-.91 1.918c-1.096 1.857-1.536 1.954-1.715 1.839-.418-.27-.313-1.085-.313-1.664 0-1.808.274-2.562-.534-2.757-.268-.065-.465-.108-1.15-.115-.878-.008-1.62.003-2.04.208-.28.137-.496.442-.365.46.163.022.532.1.728.364.253.342.244 1.11.244 1.11s.145 2.13-.34 2.394c-.332.182-.788-.189-1.767-1.887-.502-.87-.88-1.829-.88-1.829s-.073-.179-.203-.275c-.158-.117-.378-.154-.378-.154l-2.327.015s-.35.01-.478.162c-.114.135-.009.414-.009.414s1.838 4.3 3.92 6.467c1.907 1.987 4.073 1.857 4.073 1.857h.982z" fill="#0077FF" />
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
                            <label className="text-xs text-text-secondary font-bold tracking-wide uppercase px-1">Email</label>
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
                            <label className="text-xs text-text-secondary font-bold tracking-wide uppercase px-1">Пароль</label>
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
                                    <><LogIn size={18} /> Войти</>
                                ) : (
                                    <><UserPlus size={18} /> Зарегистрироваться</>
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
                            {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                        </button>


                    </div>
                </div>
            </div>
        </div>
    );
}
