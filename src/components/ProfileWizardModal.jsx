import { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Sparkles } from 'lucide-react';

export default function ProfileWizardModal({ onClose }) {
    const userProfile = useStore(state => state.userProfile) || { bio: '', goals: '', interests: '' };
    const updateUserProfile = useStore(state => state.updateUserProfile);

    const [bio, setBio] = useState(userProfile.bio || '');
    const [goals, setGoals] = useState(userProfile.goals || '');
    const [interests, setInterests] = useState(userProfile.interests || '');

    const handleSave = (e) => {
        e.preventDefault();
        updateUserProfile({ bio, goals, interests });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md rounded-none md:rounded-lg animate-fade-in">
            <div className="bg-[#13131A] border-t md:border border-white/10 p-6 md:p-8 rounded-t-3xl md:rounded-2xl w-full max-w-md shadow-[0_-20px_60px_rgba(0,0,0,0.9)] md:shadow-2xl animate-slide-up md:animate-scale-in relative pb-safe md:pb-8 flex flex-col max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"
                >
                    <X size={20} />
                </button>
                
                <div className="flex items-center gap-3 mb-6 pr-8">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                        <Sparkles size={20} className="text-accent" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl text-white">Давайте познакомимся</h3>
                        <p className="text-xs text-text-secondary">Nova хочет узнать больше о вас</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                    <div className="flex flex-col gap-1.5 mt-1">
                        <label className="text-sm font-semibold text-text-primary px-1">Кто вы? (Краткое Био)</label>
                        <textarea
                            className="bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none min-h-[80px] w-full resize-none placeholder-text-secondary/50"
                            placeholder="Например: Я дизайнер, работаю на фрилансе..."
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-text-primary px-1">Главные цели (на квартал/год)</label>
                        <textarea
                            className="bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none min-h-[80px] w-full resize-none placeholder-text-secondary/50"
                            placeholder="Например: Выучить английский, запустить проект..."
                            value={goals}
                            onChange={(e) => setGoals(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mb-2">
                        <label className="text-sm font-semibold text-text-primary px-1">Интересы и хобби</label>
                        <textarea
                            className="bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none min-h-[80px] w-full resize-none placeholder-text-secondary/50"
                            placeholder="Например: Люблю видеоигры, гитару и читать..."
                            value={interests}
                            onChange={(e) => setInterests(e.target.value)}
                        />
                    </div>
                    
                    <button
                        type="submit"
                        className="w-full btn-primary py-3.5 rounded-xl font-bold text-[15px] shadow-[0_0_20px_rgba(99,102,241,0.3)] mt-2"
                    >
                        Сохранить профиль
                    </button>
                </form>
            </div>
        </div>
    );
}
