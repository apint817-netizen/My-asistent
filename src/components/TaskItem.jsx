import { useState, useRef, forwardRef } from 'react';
import { TASK_CATEGORIES } from '../store/useStore';
import { Check, Trash2, Zap, ChevronsUpDown, Edit2, MoreVertical, Calendar, Pause, Clock, Play } from 'lucide-react';
import { playHoverSound } from '../utils/sound';

export const TaskItem = forwardRef(({ task, index, handleToggle, setDeletingTask, setEditingTaskCategory, setEditingTask, isDragOverlay, attributes, listeners, style, setNodeRef, onPostpone, onReschedule, onUnpostpone }, ref) => {
    const categoryObj = task.category ? TASK_CATEGORIES.find(c => c.id === task.category) : null;
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const touchStartRef = useRef(null);

    const handleTouchStart = (e) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsSwiping(false);
    };
    const handleTouchMove = (e) => {
        if (!touchStartRef.current) return;
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
            setIsSwiping(true);
            setSwipeX(Math.max(dx, -100));
        }
    };
    const handleTouchEnd = () => {
        if (swipeX < -60) {
            setSwipeX(-80);
        } else {
            setSwipeX(0);
        }
        touchStartRef.current = null;
        setIsSwiping(false);
    };
    const resetSwipe = () => setSwipeX(0);

    // Форматирование даты для бейджа
    const formatDueDate = (dateStr) => {
        if (!dateStr) return null;
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        if (dateStr === today) return 'Сегодня';
        if (dateStr === tomorrow) return 'Завтра';
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}`;
    };

    const dueDateLabel = formatDueDate(task.dueDate);

    return (
        <>
            <div className="relative overflow-hidden md:overflow-visible rounded-xl" onClick={() => { if (swipeX !== 0) resetSwipe(); }}>
                {/* Swipe-to-delete background (mobile only) */}
                {!task.completed && swipeX < 0 && (
                    <div className="md:hidden absolute inset-y-0 right-0 w-20 bg-danger flex items-center justify-center z-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); setDeletingTask(task); resetSwipe(); }}
                            className="flex flex-col items-center gap-1 text-white"
                        >
                            <Trash2 size={18} />
                            <span className="text-[10px] font-semibold">Удалить</span>
                        </button>
                    </div>
                )}

                <div
                    ref={setNodeRef || ref}
                    style={{ ...style, transform: `${style?.transform || ''} translateX(${swipeX}px)`.trim(), transition: isSwiping ? 'none' : (style?.transition || 'transform 0.2s ease-out') }}
                    className={`glass-card p-3 sm:p-4 flex items-center justify-between group origin-center relative z-10 bg-bg-secondary ${task.completed ? 'opacity-50' : ''} ${task.postponed ? 'opacity-60' : ''} ${isDragOverlay ? 'shadow-2xl border-accent/80 ring-2 ring-accent/60 bg-[#13131A] z-[100] backdrop-blur-3xl opacity-100' : ''}`}
                    onTouchStart={!task.completed ? handleTouchStart : undefined}
                    onTouchMove={!task.completed ? handleTouchMove : undefined}
                    onTouchEnd={!task.completed ? handleTouchEnd : undefined}
                >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Drag handle — desktop only */}
                        <div {...attributes} {...listeners} className={`hidden md:flex text-text-secondary hover:text-white p-1.5 hover:bg-white/5 rounded-md transition-colors mt-0.5 outline-none touch-none group/drag relative ${isDragOverlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}>
                            <ChevronsUpDown size={16} />
                            {!isDragOverlay && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1b1b22] text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/drag:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-white/10 z-50">Перетащить</div>
                            )}
                        </div>
                        {/* Checkbox — 44x44 touch target */}
                        <div className="w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => handleToggle(task)}>
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${task.completed ? 'bg-success border-success' : 'border-text-secondary'}`}>
                                {task.completed && <Check size={14} className="text-bg-primary font-bold w-3 h-3 sm:w-4 sm:h-4" />}
                            </div>
                        </div>
                        {/* Task content block */}
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            {/* Task title */}
                            <span className={`font-medium text-sm leading-tight break-words line-clamp-2 ${task.completed ? 'line-through text-text-secondary' : task.postponed ? 'text-text-secondary' : 'text-text-primary'}`}>
                                {task.title}
                            </span>
                            {/* Meta row: category + date + time */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {categoryObj && (
                                    <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryObj.bg} ${categoryObj.color} border border-current/20 cursor-pointer hover:opacity-80 transition-opacity`}
                                        onClick={(e) => { e.stopPropagation(); if (setEditingTaskCategory) setEditingTaskCategory(task.id); }}
                                    >
                                        {categoryObj.name}
                                    </span>
                                )}
                                {dueDateLabel && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-0.5">
                                        <Calendar size={9} />
                                        {dueDateLabel}
                                    </span>
                                )}
                                {task.dueTime && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-0.5">
                                        <Clock size={9} />
                                        {task.dueTime}
                                    </span>
                                )}
                                {task.postponed && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 flex items-center gap-0.5">
                                        <Pause size={9} />
                                        На потом
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-2">
                        <div className="flex items-center gap-1 text-warning font-bold text-[13px] sm:text-base bg-warning/10 px-1.5 sm:px-2 py-1 rounded-lg shrink-0">
                            <Zap size={12} className="sm:w-4 sm:h-4" />
                            +{task.value}
                        </div>
                        {/* Mobile: ⋯ button for context menu */}
                        {!task.completed && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
                                className="md:hidden flex p-2 text-text-secondary hover:text-white rounded-md transition-colors"
                            >
                                <MoreVertical size={16} />
                            </button>
                        )}
                        {/* Desktop: Edit button */}
                        {!task.completed && setEditingTask && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                onMouseEnter={playHoverSound}
                                className="hidden md:flex p-1.5 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 group/edit relative"
                            >
                                <Edit2 size={14} />
                                {!isDragOverlay && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1b1b22] text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/edit:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-white/10 z-50">Редактировать</div>
                                )}
                            </button>
                        )}
                        {/* Desktop: Delete button */}
                        {!task.completed && setDeletingTask && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setDeletingTask(task); }}
                                onMouseEnter={playHoverSound}
                                className="hidden md:flex p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 group/del relative"
                            >
                                <Trash2 size={15} />
                                {!isDragOverlay && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-danger/90 text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/del:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-danger/50 z-50">Удалить</div>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Sheet Menu */}
            {showMenu && (
                <div className="fixed inset-0 z-[200] md:hidden" onClick={() => setShowMenu(false)}>
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
                    {/* Sheet */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[#13131A] border-t border-white/10 rounded-t-3xl p-4 pb-safe animate-slide-up"
                         onClick={(e) => e.stopPropagation()}>
                        {/* Handle */}
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />
                        {/* Task title */}
                        <p className="text-sm font-semibold text-white mb-3 line-clamp-1 px-1">{task.title}</p>
                        {/* Actions */}
                        <div className="flex flex-col gap-1">
                            {setEditingTask && (
                                <button
                                    onClick={() => { setShowMenu(false); setEditingTask(task); }}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors"
                                >
                                    <Edit2 size={18} className="text-accent" />
                                    Редактировать
                                </button>
                            )}
                            {onReschedule && (
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                                        onReschedule(task.id, tomorrow);
                                    }}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors"
                                >
                                    <Calendar size={18} className="text-blue-400" />
                                    Перенести на завтра
                                </button>
                            )}
                            {task.postponed ? (
                                onUnpostpone && (
                                    <button
                                        onClick={() => { setShowMenu(false); onUnpostpone(task.id); }}
                                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors"
                                    >
                                        <Play size={18} className="text-emerald-400" />
                                        Вернуть в активные
                                    </button>
                                )
                            ) : (
                                onPostpone && (
                                    <button
                                        onClick={() => { setShowMenu(false); onPostpone(task.id); }}
                                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors"
                                    >
                                        <Pause size={18} className="text-gray-400" />
                                        На потом
                                    </button>
                                )
                            )}
                            {setDeletingTask && (
                                <button
                                    onClick={() => { setShowMenu(false); setDeletingTask(task); }}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-danger hover:bg-danger/5 transition-colors"
                                >
                                    <Trash2 size={18} />
                                    Удалить
                                </button>
                            )}
                        </div>
                        {/* Cancel */}
                        <button
                            onClick={() => setShowMenu(false)}
                            className="w-full mt-2 py-3.5 rounded-xl bg-white/5 text-sm font-semibold text-text-secondary hover:bg-white/10 transition-colors"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}
        </>
    );
});
