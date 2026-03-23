import { useState } from 'react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';
import { X, Save, Edit2 } from 'lucide-react';

export default function EditTaskModal({ task, onClose }) {
    const updateTask = useStore(state => state.updateTask);
    
    // Fallbacks just in case task is missing
    const [title, setTitle] = useState(task?.title || '');
    const [value, setValue] = useState(task?.value || 10);
    const [categoryId, setCategoryId] = useState(task?.category || null);

    if (!task) return null;

    const handleSave = (e) => {
        e.preventDefault();
        if (title.trim()) {
            updateTask(task.id, { title: title.trim(), value: Number(value), category: categoryId });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-[#13131A] border-t md:border border-white/10 p-6 rounded-t-3xl md:rounded-2xl w-full max-w-sm shadow-[0_-20px_60px_rgba(0,0,0,0.9)] md:shadow-2xl animate-slide-up md:animate-scale-in relative pb-safe md:pb-6">
                <div className="w-full flex justify-center pb-4 md:hidden shrink-0 pointer-events-none absolute top-3 left-0 right-0">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"
                >
                    <X size={20} />
                </button>

                <h3 className="font-bold text-xl text-white mb-6 pt-2 md:pt-0 flex items-center gap-2">
                    <Edit2 size={20} className="text-accent" />
                    Редактировать задачу
                </h3>

                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase px-1">Название</label>
                        <input
                            type="text"
                            className="bg-black/30 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 w-1/3">
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1">Очки</label>
                            <input
                                type="number"
                                className="bg-black/30 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                min="1"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 w-2/3">
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1">Категория</label>
                            <div className="relative">
                                <select
                                    className="bg-black/30 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full appearance-none pr-10"
                                    value={categoryId || ''}
                                    onChange={(e) => setCategoryId(e.target.value || null)}
                                >
                                    <option value="">Без категории</option>
                                    {TASK_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-white"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <button
                        type="submit"
                        disabled={!title.trim()}
                        className="w-full btn-primary py-3.5 rounded-xl font-bold text-[15px] mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        Сохранить
                    </button>
                </form>
            </div>
        </div>
    );
}
