import { useState, useRef } from 'react';
import { TASK_CATEGORIES } from '../store/useStore';
import { Check, Trash2, Zap, ChevronsUpDown } from 'lucide-react';

export function TaskItem({ task, index, handleToggle, setDeletingTask, setEditingTaskCategory, isDragOverlay, attributes, listeners, style, setNodeRef }) {
    const categoryObj = task.category ? TASK_CATEGORIES.find(c => c.id === task.category) : null;
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const touchStartRef = useRef(null);

    const handleTouchStart = (e) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsSwiping(false);
    };
    const handleTouchMove = (e) => {
        if (!touchStartRef.current) return;
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;
        // Only swipe horizontally if horizontal movement > vertical
        if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
            setIsSwiping(true);
            setSwipeX(Math.max(dx, -100));
        }
    };
    const handleTouchEnd = () => {
        if (swipeX < -60) {
            setSwipeX(-80); // Lock to show delete button
        } else {
            setSwipeX(0);
        }
        touchStartRef.current = null;
        setIsSwiping(false);
    };
    const resetSwipe = () => setSwipeX(0);

    return (
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
                ref={setNodeRef}
                style={{ ...style, transform: `${style?.transform || ''} translateX(${swipeX}px)`.trim(), transition: isSwiping ? 'none' : (style?.transition || 'transform 0.2s ease-out') }}
                className={`glass-card p-3 sm:p-4 flex items-center justify-between group origin-center relative z-10 bg-bg-secondary ${task.completed ? 'opacity-50' : ''} ${isDragOverlay ? 'shadow-2xl border-accent/80 ring-2 ring-accent/60 bg-[#13131A] z-[100] backdrop-blur-3xl opacity-100' : ''}`}
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
                    {/* Category dot — ALWAYS visible on mobile */}
                    {categoryObj && (
                        <div
                            className={`w-2 h-2 rounded-full shrink-0 md:hidden ${categoryObj.bg}`}
                            onClick={(e) => { e.stopPropagation(); if (setEditingTaskCategory) setEditingTaskCategory(task.id); }}
                        />
                    )}
                    {/* Checkbox — 44x44 touch target */}
                    <div className="w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => handleToggle(task)}>
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${task.completed ? 'bg-success border-success' : 'border-text-secondary'}`}>
                            {task.completed && <Check size={14} className="text-bg-primary font-bold w-3 h-3 sm:w-4 sm:h-4" />}
                        </div>
                    </div>
                    {/* Task title */}
                    <span className={`font-medium cursor-pointer text-sm leading-tight break-words line-clamp-2 flex-1 min-w-0 ${task.completed ? 'line-through text-text-secondary' : 'text-text-primary'}`} onClick={() => handleToggle(task)}>
                        {task.title}
                    </span>
                    {/* Category label — desktop only */}
                    <div
                        className="hidden md:flex items-center gap-1 cursor-pointer group/cat relative"
                        onClick={(e) => { e.stopPropagation(); if (setEditingTaskCategory) setEditingTaskCategory(task.id); }}
                    >
                        {!isDragOverlay && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1b1b22] text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/cat:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-white/10 z-50">Изменить категорию</div>
                        )}
                        {categoryObj ? (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryObj.bg} ${categoryObj.color} border border-current/20 hover:opacity-80 transition-opacity`}>
                                {categoryObj.name}
                            </span>
                        ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-text-secondary border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10">
                                + Категория
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-2">
                    <div className="flex items-center gap-1 text-warning font-bold text-[13px] sm:text-base bg-warning/10 px-1.5 sm:px-2 py-1 rounded-lg shrink-0">
                        <Zap size={12} className="sm:w-4 sm:h-4" />
                        +{task.value}
                    </div>
                    {/* Delete button — desktop only (mobile uses swipe) */}
                    {!task.completed && setDeletingTask && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setDeletingTask(task); }}
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
    );
}
