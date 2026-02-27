import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Trash2, CheckCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

const CalendarView = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskValue, setNewTaskValue] = useState(10);
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

        addCalendarTask(selectedDate, newTaskTitle.trim(), Number(newTaskValue));
        setNewTaskTitle('');
        setNewTaskValue(10);
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
        <section className="glass-panel p-6 flex flex-col md:flex-row gap-8 animate-fade-in relative overflow-hidden">
            <div className="flex-1">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CalendarIcon size={20} className="text-accent" />
                        Ближайшие планы
                    </h2>
                    <div className="flex items-center gap-4 bg-bg-secondary px-3 py-1.5 rounded-xl border border-border">
                        <button onClick={prevMonth} className="hover:text-accent transition-colors">
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
                                <div className="absolute top-full mt-2 bg-bg-secondary border border-border rounded-xl shadow-2xl p-3 min-w-[200px] animate-fade-in right-0 sm:right-auto z-50">
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
                                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1))} className="p-1 hover:text-accent"><ChevronLeft size={16} /></button>
                                        <span className="font-bold">{currentDate.getFullYear()}</span>
                                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1))} className="p-1 hover:text-accent"><ChevronRight size={16} /></button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {monthNames.map((m, index) => (
                                            <button
                                                key={m}
                                                onClick={() => {
                                                    setCurrentDate(new Date(currentDate.getFullYear(), index, 1));
                                                    setSelectedDate(null);
                                                    setShowMonthPicker(false);
                                                }}
                                                className={`text-xs py-1.5 rounded-lg transition-colors ${currentDate.getMonth() === index ? 'bg-accent text-white font-bold' : 'hover:bg-white/10'}`}
                                            >
                                                {m.substring(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
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

                <div className="grid grid-cols-7 gap-2">
                    {days.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className="h-14"></div>;

                        const dayStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const isSelected = selectedDate === dayStr;
                        const isToday = dayStr === new Date().toISOString().split('T')[0];
                        const points = getDayWorkload(dayStr);
                        const hasTasks = points > 0;

                        return (
                            <button
                                key={index}
                                onClick={() => handleDayClick(dayStr)}
                                className={`h-14 md:h-20 rounded-xl flex flex-col items-center justify-start p-2 text-sm transition-all border
                            ${isSelected ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]' :
                                        hasTasks ? getWorkloadColor(points) + ' hover:border-accent/40 text-text-primary' :
                                            'bg-bg-secondary border-border hover:border-white/20 text-text-secondary'
                                    }
                            ${isToday && !isSelected ? 'ring-1 ring-white/30' : ''}`}
                            >
                                <span className={`font-semibold ${isToday ? 'text-white' : ''} ${isSelected ? 'text-accent' : ''}`}>{day}</span>
                                {hasTasks && (
                                    <div className="mt-1 flex items-center gap-1 opacity-80">
                                        <div className={`w-1.5 h-1.5 rounded-full ${points >= 80 ? 'bg-error' : points >= 30 ? 'bg-warning' : 'bg-accent'}`}></div>
                                        <span className="text-[10px] font-bold">{points}</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedDate && (
                <div className="md:w-1/3 flex flex-col bg-bg-secondary/50 rounded-2xl border border-border p-5 border-l-2 border-l-accent animate-fade-in relative">

                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-white">Список {selectedDate}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 mb-4 min-h-[150px] max-h-[300px]">
                        {selectedDateTasks.length === 0 ? (
                            <div className="text-center text-text-secondary italic text-sm mt-10">
                                Нет запланированных задач на этот день.
                            </div>
                        ) : (
                            selectedDateTasks.map(task => (
                                <div key={task.id + task.source} className={`bg-bg-primary border p-3 rounded-xl flex items-center justify-between group ${task.source === 'main' ? 'border-blue-500/30 bg-blue-500/5' : 'border-border'}`}>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => task.source === 'calendar'
                                                ? toggleCalendarTask(selectedDate, task.id)
                                                : useStore.getState().toggleTask(task.id)
                                            }
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors 
                                            ${task.completed ? 'bg-success border-success text-black' : 'border-text-secondary hover:border-success'}`}
                                        >
                                            {task.completed && <CheckCircle size={12} strokeWidth={3} />}
                                        </button>
                                        <div className="flex flex-col">
                                            <span className={`text-sm ${task.completed ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                                                {task.source === 'main' && <span className="text-blue-400 mr-1">📋</span>}
                                                {task.title}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-accent font-bold">+{task.value} ОЧКОВ</span>
                                                {task.source === 'main' && (
                                                    <span className="text-[9px] text-blue-400/70 font-medium">Основной список</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {task.source === 'calendar' && (
                                        <button
                                            onClick={() => deleteCalendarTask(selectedDate, task.id)}
                                            className="text-text-secondary hover:text-error transition-colors p-1 opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleAddTask} className="flex flex-col gap-3 mt-auto pt-4 border-t border-border">
                        <label className="text-xs text-text-secondary font-bold uppercase tracking-wider">Запланировать задачу</label>
                        <input
                            type="text"
                            placeholder="Название задачи..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="bg-black/40 border border-border rounded-xl px-4 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                        />
                        <div className="flex gap-2">
                            <select
                                value={newTaskValue}
                                onChange={(e) => setNewTaskValue(Number(e.target.value))}
                                className="bg-black/40 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
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
                                className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent font-bold py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};

export default CalendarView;
