import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Trash2, CheckCircle } from 'lucide-react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';

const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskValue, setNewTaskValue] = useState(10);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    const { calendarTasks, addCalendarTask, deleteCalendarTask, toggleCalendarTask } = useStore();
    const tasks = useStore(state => state.tasks);
    const todayStr = new Date().toISOString().split('T')[0];

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        let day = new Date(year, month, 1).getDay();
        // transform to monday-first week (0 = Monday, 6 = Sunday)
        return day === 0 ? 6 : day - 1;
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
    };

    const formatDateString = (year, month, day) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    // Generate calendar grid
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const fullWeekDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    const getWeekdayName = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return fullWeekDays[d.getDay()];
    };

    const handleDayClick = (dayStr) => {
        if (selectedDate === dayStr) {
            setSelectedDate(null);
        } else {
            setSelectedDate(dayStr);
        }
    };

    const handleAddTask = (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !selectedDate) return;

        addCalendarTask(selectedDate, newTaskTitle.trim(), Number(newTaskValue), selectedCategory || null);
        setNewTaskTitle('');
        setNewTaskValue(10);
        setSelectedCategory('');
    };

    // Объединяем задачи: calendarTasks + mainTasks для сегодня
    const getTasksForDate = (dateStr) => {
        const calTasks = (calendarTasks[dateStr] || []).map(t => ({ ...t, source: 'calendar' }));
        if (dateStr === todayStr) {
            // Добавляем задачи с основного экрана (исключая те, что уже были из календаря)
            const mainTasks = tasks
                .filter(t => !t.fromCalendar)
                .map(t => ({ ...t, source: 'main' }));
            return [...calTasks, ...mainTasks];
        }
        return calTasks;
    };

    const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

    // Calculate total workload per day (включая задачи с основного экрана для сегодня)
    const getDayWorkload = (dayStr) => {
        const allTasks = getTasksForDate(dayStr);
        if (allTasks.length === 0) return 0;
        return allTasks.reduce((sum, task) => sum + task.value, 0);
    };

    const getWorkloadColor = (points) => {
        if (points === 0) return 'bg-transparent';
        if (points < 30) return 'bg-accent/20 border-accent/30';
        if (points < 80) return 'bg-warning/20 border-warning/30';
        return 'bg-error/20 border-error/30';
    };

    return (
        <section className="glass-panel p-4 sm:p-6 animate-fade-in relative overflow-hidden">
            <div className={`flex flex-col lg:flex-row gap-6 items-start`}>
                <div className="flex-1 w-full min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CalendarIcon size={20} className="text-accent shrink-0" />
                        <span className="sm:hidden">Планы</span>
                        <span className="hidden sm:inline">Ближайшие планы</span>
                    </h2>
                    <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 bg-bg-secondary px-2 sm:px-3 py-1.5 rounded-xl border border-border w-full sm:w-auto">
                        <button onClick={prevMonth} className="hover:text-accent transition-colors p-2 sm:p-0">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="relative flex items-center justify-center min-w-32 z-10">
                            <button
                                onClick={() => setShowMonthPicker(!showMonthPicker)}
                                className="font-semibold text-center text-sm hover:text-accent transition-colors px-2 py-1 rounded-md"
                            >
                                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </button>

                            {showMonthPicker && (
                                <>
                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] sm:hidden" onClick={() => setShowMonthPicker(false)} />
                                    <div className="absolute top-full sm:mt-2 bg-bg-secondary border border-border rounded-2xl shadow-2xl p-4 min-w-[280px] sm:min-w-[200px] animate-fade-in fixed left-1/2 -translate-x-1/2 bottom-1/2 translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0 z-[110] sm:right-auto">
                                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1))} className="p-2 hover:text-accent bg-white/5 rounded-lg"><ChevronLeft size={18} /></button>
                                            <span className="font-bold text-lg">{currentDate.getFullYear()}</span>
                                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1))} className="p-2 hover:text-accent bg-white/5 rounded-lg"><ChevronRight size={18} /></button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {monthNames.map((m, index) => (
                                                <button
                                                    key={m}
                                                    onClick={() => {
                                                        setCurrentDate(new Date(currentDate.getFullYear(), index, 1));
                                                        setSelectedDate(null);
                                                        setShowMonthPicker(false);
                                                    }}
                                                    className={`text-sm py-3 rounded-xl transition-all ${currentDate.getMonth() === index ? 'bg-accent text-white font-bold shadow-lg shadow-accent/20' : 'hover:bg-white/10 active:scale-95'}`}
                                                >
                                                    {m.substring(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={nextMonth} className="hover:text-accent transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center font-bold text-text-secondary text-xs uppercase py-2">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2 md:gap-3">
                    {days.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className="h-16 md:h-24"></div>;

                        const dayStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const isSelected = selectedDate === dayStr;
                        const isToday = dayStr === new Date().toISOString().split('T')[0];

                        const tasksForDay = getTasksForDate(dayStr);
                        const totalCount = tasksForDay.length;
                        const completedCount = tasksForDay.filter(t => t.completed).length;
                        const uncompletedCount = totalCount - completedCount;
                        const points = tasksForDay.reduce((sum, task) => sum + task.value, 0);

                        return (
                            <button
                                key={index}
                                onClick={() => handleDayClick(dayStr)}
                                className={`h-16 md:h-24 rounded-2xl flex flex-col items-center justify-start p-1.5 md:p-3 text-sm transition-all duration-300 border relative group overflow-hidden
                            ${isSelected ? 'bg-accent/20 border-accent/50 text-accent shadow-[0_0_20px_rgba(var(--color-accent),0.3)] scale-[1.02] z-10' :
                                        totalCount > 0 ? 'bg-bg-primary/60 border-accent/20 hover:border-accent/50 text-text-primary hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(var(--color-accent),0.1)]' :
                                            'bg-bg-secondary/40 border-border/50 hover:border-white/20 text-text-secondary hover:bg-bg-secondary/80'
                                    }
                            ${isToday && !isSelected ? 'ring-2 ring-white/20 bg-white/5' : ''}`}
                            >
                                {/* Glow effect on hover */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                                <span className={`font-bold text-lg md:text-xl relative z-10 ${isToday ? 'text-white drop-shadow-md' : ''} ${isSelected ? 'text-accent drop-shadow-[0_0_8px_rgba(var(--color-accent),0.8)]' : ''}`}>{day}</span>

                                {totalCount > 0 && (
                                    <div className="mt-auto w-full flex flex-col items-center gap-1 md:gap-1.5 relative z-10">
                                        {/* Task Indicators */}
                                        <div className="flex gap-1 justify-center items-center max-w-full px-1">
                                            {Array.from({ length: Math.min(completedCount, 3) }).map((_, i) => (
                                                <div key={`c-${i}`} className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-success shadow-[0_0_5px_rgba(34,197,94,0.6)] shrink-0"></div>
                                            ))}
                                            {Array.from({ length: Math.min(uncompletedCount, Math.max(0, 3 - completedCount)) }).map((_, i) => (
                                                <div key={`u-${i}`} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${points >= 80 ? 'bg-error shadow-[0_0_5px_rgba(239,68,68,0.6)]' : points >= 40 ? 'bg-warning shadow-[0_0_5px_rgba(245,158,11,0.6)]' : 'bg-accent shadow-[0_0_5px_rgba(var(--color-accent),0.6)]'} shrink-0`}></div>
                                            ))}
                                            {totalCount > 3 && (
                                                <span className="text-[7px] md:text-[8px] font-bold text-white/80 ml-0.5 leading-none">+{totalCount - 3}</span>
                                            )}
                                        </div>
                                        {/* Points Badge */}
                                        <div className="flex flex-col items-center justify-center leading-none mt-1 w-[90%] mx-auto">
                                            <span className="text-[8px] md:text-[9px] font-black tracking-wider text-white opacity-90 truncate w-full text-center">
                                                {totalCount} {totalCount === 1 ? 'задача' : (totalCount % 10 >= 2 && totalCount % 10 <= 4 && (totalCount % 100 < 10 || totalCount % 100 >= 20)) ? 'задачи' : 'задач'}
                                            </span>
                                            <span className={`text-[7px] md:text-[8px] tracking-wide py-[2px] px-1 md:px-1.5 rounded bg-black/60 shadow-inner mt-[3px] w-full text-center truncate ${points >= 80 ? 'text-error' : points >= 40 ? 'text-warning' : 'text-accent'}`}>
                                                {tasksForDay.filter(t => t.completed).reduce((s, t) => s + t.value, 0)} / {points} очк
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedDate && (
                <div className="w-full lg:w-[380px] shrink-0 flex flex-col bg-bg-secondary/60 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl p-5 md:p-6 border-t-2 border-t-accent animate-fade-in relative overflow-hidden lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)]">
                    {/* Background glow in the panel */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none -mt-10 -mr-10"></div>

                    <div className="flex justify-between items-center mb-6 relative z-10 shrink-0">
                        <h3 className="font-bold text-xl md:text-2xl text-white tracking-tight">Список <span className="text-accent">{selectedDate.split('-').reverse().join('.')}</span> <span className="text-text-secondary md:text-lg text-base font-medium ml-1">({getWeekdayName(selectedDate)})</span></h3>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar space-y-3 md:space-y-4 mb-4 min-h-[200px] relative z-10 w-full">
                        {selectedDateTasks.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-60 mt-12 space-y-4">
                                <CalendarIcon size={40} className="text-accent/40" />
                                <span className="italic text-sm text-center">Нет запланированных задач.<br />Добавьте новую снизу.</span>
                            </div>
                        ) : (
                            selectedDateTasks.map(task => (
                                <div key={task.id + task.source} className={`bg-bg-primary/80 backdrop-blur-sm border p-3 md:p-4 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${task.source === 'main' ? 'border-blue-500/30 bg-blue-500/10 hover:border-blue-500/60 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] = hover:bg-blue-500/20' : 'border-white/5 hover:border-accent/40 hover:shadow-[0_0_15px_rgba(var(--color-accent),0.1)] hover:bg-bg-primary'}`}>
                                    <div className="flex items-start gap-4 flex-1">
                                        <button
                                            onClick={() => task.source === 'calendar'
                                                ? toggleCalendarTask(selectedDate, task.id)
                                                : useStore.getState().toggleTask(task.id)
                                            }
                                            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0
                                            ${task.completed ? 'bg-success border-success text-black scale-110 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'border-text-secondary hover:border-success hover:scale-110'}`}
                                        >
                                            {task.completed && <CheckCircle size={14} strokeWidth={3} className="animate-fade-in" />}
                                        </button>
                                        <div className="flex flex-col flex-1 pb-1">
                                            <span className={`text-sm md:text-base font-medium transition-colors ${task.completed ? 'line-through text-text-secondary' : 'text-gray-100'}`}>
                                                {task.source === 'main' && <span className="text-blue-400 mr-2 drop-shadow-md">📋</span>}
                                                {task.title}
                                            </span>
                                            {task.category && (() => {
                                                const catObj = TASK_CATEGORIES.find(c => c.id === task.category);
                                                if (!catObj) return null;
                                                return (
                                                    <div className="mt-1">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catObj.bg} ${catObj.color} border border-current/20`}>
                                                            {catObj.name}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-[10px] md:text-xs text-accent font-black tracking-widest bg-accent/10 px-2 py-0.5 rounded text-glow">+{task.value} ОЧКОВ</span>
                                                {task.source === 'main' && (
                                                    <span className="text-[10px] text-blue-400/80 font-semibold tracking-wide uppercase">Основной список</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {task.source === 'calendar' ? (
                                        <button
                                            onClick={() => deleteCalendarTask(selectedDate, task.id)}
                                            className="text-text-secondary hover:text-error transition-all duration-300 p-2 opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-error/20 rounded-xl ml-2 shrink-0"
                                            title="Удалить задачу из календаря"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                useStore.getState().deleteTaskWithReason(task.id, 'Удалено из календаря');
                                                useStore.getState().addToast('Задача удалена с главного экрана', 'info');
                                            }}
                                            className="text-text-secondary hover:text-error transition-all duration-300 p-2 opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-error/20 rounded-xl ml-2 shrink-0"
                                            title="Удалить основную задачу"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleAddTask} className="flex flex-col gap-3 md:gap-4 mt-auto pt-6 border-t border-white/5 relative z-10">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>
                        <label className="text-xs text-text-secondary font-black uppercase tracking-widest flex items-center gap-2">
                            <Plus size={14} className="text-accent" />
                            Добавить задачу
                        </label>
                        <input
                            type="text"
                            placeholder="Название задачи..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="bg-black/40 border border-border rounded-xl px-4 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-black/40 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer flex-1"
                            >
                                <option value="">Без категории</option>
                                {TASK_CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <div className="flex gap-2 flex-1">
                                <select
                                    value={newTaskValue}
                                    onChange={(e) => setNewTaskValue(Number(e.target.value))}
                                    className="bg-black/40 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer w-full"
                                >
                                    <option value={5}>5 очков</option>
                                    <option value={10}>10 очков</option>
                                    <option value={15}>15 очков</option>
                                    <option value={30}>30 очков</option>
                                    <option value={50}>50 очков</option>
                                    <option value={100}>100 очков</option>
                                </select>
                                <button
                                    type="submit"
                                    disabled={!newTaskTitle.trim()}
                                    className="bg-accent/20 hover:bg-accent/30 text-accent font-bold py-2 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
            </div>
        </section>
    );
};

export default CalendarView;
