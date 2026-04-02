import { useState } from 'react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';
import { X, Save, Edit2, Clock, Bell, Calendar } from 'lucide-react';
import { playHoverSound, playKeyClick } from '../utils/sound';

const REMINDER_OPTIONS = [
    { key: '1h', label: 'За 1 час', minutes: 60 },
    { key: '30m', label: 'За 30 мин', minutes: 30 },
    { key: '15m', label: 'За 15 мин', minutes: 15 },
];

export default function EditTaskModal({ task, onClose }) {
    const updateTask = useStore(state => state.updateTask);
    
    const [title, setTitle] = useState(task?.title || '');
    const [value, setValue] = useState(task?.value || 10);
    const [categoryId, setCategoryId] = useState(task?.category || null);
    const [dueDate, setDueDate] = useState(task?.dueDate || '');
    const [dueTime, setDueTime] = useState(task?.dueTime || '');
    const [reminders, setReminders] = useState(task?.reminders || []);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    if (!task) return null;

    const toggleReminder = (key) => {
        setReminders(prev => 
            prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
        );
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (title.trim()) {
            updateTask(task.id, { 
                title: title.trim(), 
                value: Number(value), 
                category: categoryId,
                dueDate: dueDate || null,
                dueTime: dueTime || null,
                reminders: dueTime ? reminders : [],
                remindersSent: []
            });
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-[#13131A] border-t md:border border-white/10 p-6 rounded-t-3xl md:rounded-2xl w-full max-w-sm shadow-[0_-20px_60px_rgba(0,0,0,0.9)] md:shadow-2xl animate-slide-up md:animate-scale-in relative pb-safe md:pb-6" style={{ overflow: 'visible' }}>
                <div className="w-full flex justify-center pb-4 md:hidden shrink-0 pointer-events-none absolute top-3 left-0 right-0">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                
                <button
                    onClick={onClose}
                    onMouseEnter={playHoverSound}
                    className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors p-2 bg-white/5 hover:bg-white/10 rounded-full"
                >
                    <X size={20} />
                </button>

                <h3 className="font-bold text-xl text-white mb-6 pt-2 md:pt-0 flex items-center gap-2">
                    <Edit2 size={20} className="text-accent" />
                    Редактировать задачу
                </h3>

                <form onSubmit={handleSave} className="flex flex-col gap-4" style={{ overflow: 'visible' }}>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase px-1">Название</label>
                        <input
                            type="text"
                            className="bg-black/30 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={playKeyClick}
                            required
                        />
                    </div>
                    
                    <div className="flex gap-4" style={{ overflow: 'visible' }}>
                        <div className="flex flex-col gap-1.5 w-1/3">
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1">Очки</label>
                            <input
                                type="number"
                                className="bg-black/30 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={playKeyClick}
                                min="1"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 w-2/3" style={{ overflow: 'visible' }}>
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1">Категория</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onMouseEnter={playHoverSound}
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="bg-black/30 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-accent outline-none w-full text-left flex items-center justify-between transition-colors hover:bg-black/40"
                                >
                                    <span className="truncate">
                                        {categoryId 
                                            ? TASK_CATEGORIES.find(c => c.id === categoryId)?.name 
                                            : 'Без категории'}
                                    </span>
                                    <div className="pointer-events-none opacity-50 shrink-0 ml-2">
                                        <div className={`w-0 h-0 border-l-[5px] border-r-[5px] border-transparent transition-transform ${dropdownOpen ? 'border-b-[5px] border-b-white' : 'border-t-[5px] border-t-white'}`}></div>
                                    </div>
                                </button>
                                
                                {dropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[150]" onClick={() => setDropdownOpen(false)}></div>
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl z-[200] overflow-hidden animate-scale-in">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCategoryId(null);
                                                    setDropdownOpen(false);
                                                }}
                                                onMouseEnter={playHoverSound}
                                                className="w-full text-left px-4 py-3 text-sm transition-colors text-white hover:bg-white/5 border-b border-white/5"
                                            >
                                                Без категории
                                            </button>
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {TASK_CATEGORIES.map(cat => (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setCategoryId(cat.id);
                                                            setDropdownOpen(false);
                                                        }}
                                                        onMouseEnter={playHoverSound}
                                                        className="w-full text-left px-4 py-3 text-sm transition-colors text-white hover:bg-white/5 flex items-center gap-2"
                                                    >
                                                        <span className={`w-3 h-3 rounded-full ${cat.bg}`}></span>
                                                        {cat.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Дата и время */}
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1 flex items-center gap-1">
                                <Calendar size={10} />
                                Дата
                            </label>
                            <input
                                type="date"
                                className="bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full [color-scheme:dark]"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1 flex items-center gap-1">
                                <Clock size={10} />
                                Время
                            </label>
                            <input
                                type="time"
                                className="bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none w-full [color-scheme:dark]"
                                value={dueTime}
                                onChange={(e) => setDueTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Напоминания — только если задано время */}
                    {dueTime && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase px-1 flex items-center gap-1">
                                <Bell size={10} />
                                Напоминания
                            </label>
                            <div className="flex gap-2">
                                {REMINDER_OPTIONS.map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => toggleReminder(opt.key)}
                                        onMouseEnter={playHoverSound}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                                            reminders.includes(opt.key) 
                                                ? 'bg-accent/15 text-accent border-accent/30 shadow-[0_0_10px_rgba(109,40,217,0.2)]' 
                                                : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        disabled={!title.trim()}
                        onMouseEnter={playHoverSound}
                        className="w-full btn-primary py-3.5 rounded-xl font-bold text-[15px] mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        Сохранить
                    </button>
                </form>
            </div>
        </div>
    );
}
