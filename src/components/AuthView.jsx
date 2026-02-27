import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, Eye, EyeOff, LogIn, UserPlus, ArrowRight } from 'lucide-react';

export default function AuthView({ onSkip }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

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

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Ошибка входа через Google');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="fixed inset-0 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary" />
            <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse" />
            <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

            <div className="glass-panel w-full max-w-md p-8 relative z-10 animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/30 to-accent-hover/30 border border-accent/30 mb-4">
                        <Sparkles size={32} className="text-accent" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Ассистент Nova</h1>
                    <p className="text-text-secondary text-sm mt-2">Ваш персональный ИИ-помощник для достижения целей</p>
                </div>

                {/* Auth Form */}
                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs text-text-secondary font-medium">Email</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                placeholder="your@email.com"
                                className="w-full bg-black/40 border border-border rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-text-secondary font-medium">Пароль</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="••••••"
                                className="w-full bg-black/40 border border-border rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="text-xs text-danger bg-danger/10 border border-danger/20 p-2.5 rounded-lg animate-fade-in">{error}</p>
                    )}
                    {success && (
                        <p className="text-xs text-success bg-success/10 border border-success/20 p-2.5 rounded-lg animate-fade-in">{success}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : mode === 'login' ? (
                            <><LogIn size={18} /> Войти</>
                        ) : (
                            <><UserPlus size={18} /> Создать аккаунт</>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-text-secondary">или</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Google Login */}
                <button
                    onClick={handleGoogleLogin}
                    className="w-full py-3 bg-white/5 border border-border text-white font-medium rounded-xl hover:bg-white/10 hover:border-border transition-all flex items-center justify-center gap-3 text-sm"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                    Войти через Google
                </button>

                {/* Toggle mode */}
                <div className="text-center mt-5">
                    <button
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
                        className="text-xs text-text-secondary hover:text-accent transition-colors"
                    >
                        {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                    </button>
                </div>

                {/* Skip button */}
                {onSkip && (
                    <div className="text-center mt-3">
                        <button
                            onClick={onSkip}
                            className="text-xs text-text-secondary/50 hover:text-text-secondary transition-colors flex items-center gap-1 mx-auto"
                        >
                            Продолжить без авторизации <ArrowRight size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
