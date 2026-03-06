import { useState } from 'react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';
import { Plus, Check, Trash2, Zap, ChevronsUpDown } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

function TaskItem({ task, index, handleToggle, setDeletingTask, setEditingTaskCategory, isDragOverlay, attributes, listeners, style, setNodeRef }) {
    const categoryObj = task.category ? TASK_CATEGORIES.find(c => c.id === task.category) : null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`glass-card p-4 flex items-center justify-between group origin-center ${task.completed ? 'opacity-50' : ''} ${isDragOverlay ? 'shadow-2xl border-accent/80 ring-2 ring-accent/60 bg-[#13131A] z-[100] backdrop-blur-3xl opacity-100' : ''}`}
        >
            <div className="flex items-center gap-3 flex-1">
                <div {...attributes} {...listeners} className={`text-text-secondary hover:text-white p-1.5 hover:bg-white/5 rounded-md transition-colors mt-0.5 outline-none touch-none group/drag relative ${isDragOverlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}>
                    <ChevronsUpDown size={16} />
                    {!isDragOverlay && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1b1b22] text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/drag:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-white/10 z-50">Перетащить</div>
                    )}
                </div>
                <div className="w-5 text-center text-xs font-bold text-text-secondary">
                    {index + 1}
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${task.completed ? 'bg-success border-success' : 'border-text-secondary'}`} onClick={() => handleToggle(task)}>
                    {task.completed && <Check size={14} className="text-bg-primary font-bold" />}
                </div>
                <span className={`font-medium cursor-pointer ${task.completed ? 'line-through text-text-secondary' : 'text-text-primary'}`} onClick={() => handleToggle(task)}>
                    {task.title}
                </span>
                <div
                    className="flex items-center gap-1 cursor-pointer group/cat relative"
                    onClick={(e) => { e.stopPropagation(); if (setEditingTaskCategory) setEditingTaskCategory(task.id); }}
                >
                    {!isDragOverlay && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1b1b22] text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/cat:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-white/10 z-50">Изменить категорию</div>
                    )}
                    {categoryObj ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryObj.bg} ${categoryObj.color} border border-current/20 hidden sm:inline-block hover:opacity-80 transition-opacity`}>
                            {categoryObj.name}
                        </span>
                    ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/5 text-text-secondary border border-white/10 hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10">
                            + Категория
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-warning font-bold">
                    <Zap size={16} />
                    +{task.value}
                </div>
                {!task.completed && setDeletingTask && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setDeletingTask(task); }}
                        className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 group/del relative"
                    >
                        <Trash2 size={16} />
                        {!isDragOverlay && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-danger/90 text-white text-[11px] font-medium py-1 px-2 rounded-md opacity-0 pointer-events-none group-hover/del:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-danger/50 z-50">Удалить</div>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

function SortableTaskItem({ task, index, handleToggle, setDeletingTask, setEditingTaskCategory }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        // Dragged item: no transition (instant cursor follow). Others: fast smooth reorder.
        transition: isDragging ? 'none' : 'transform 150ms cubic-bezier(0.25, 1, 0.5, 1)',
        zIndex: isDragging ? 50 : 1,
        position: isDragging ? 'relative' : undefined,
        willChange: 'transform',
    };

    return (
        <TaskItem
            task={task}
            index={index}
            handleToggle={handleToggle}
            setDeletingTask={setDeletingTask}
            setEditingTaskCategory={setEditingTaskCategory}
            attributes={attributes}
            listeners={listeners}
            style={style}
            setNodeRef={setNodeRef}
            isDragOverlay={isDragging}
        />
    );
}

export default function TaskManager() {
    const tasks = useStore(state => state.tasks);
    const toggleTask = useStore(state => state.toggleTask);
    const addTask = useStore(state => state.addTask);
    const addTokens = useStore(state => state.addTokens);
    const addAiTokensUsed = useStore(state => state.addAiTokensUsed);
    const deleteTaskWithReason = useStore(state => state.deleteTaskWithReason);
    const reorderTasks = useStore(state => state.reorderTasks);

    const validateInput = (text) => {
        const cleaned = text.trim();
        if (cleaned.length < 2) return 'Слишком короткое название';

        if (/^[^a-zA-Zа-яА-ЯёЁ0-9]+$/.test(cleaned)) {
            return 'Пожалуйста, введите осмысленное название';
        }

        if (/^\d+$/.test(cleaned)) {
            if (cleaned.length > 4 && !/00$/.test(cleaned)) {
                return 'Слишком много случайных цифр';
            }
        }

        if (/(.)\1{3,}/.test(cleaned)) {
            return 'Слишком много повторяющихся символов';
        }

        const smashPattern = /^(asdf|qwer|zxcv|фыва|йцук|ячсм|asd|qwe|zxc|йцу|фыв|ячс)[a-zа-яё]*$/i;
        const manyConsonantsEn = /[bcdfghjklmnpqrstvwxz]{5,}/i;
        const manyConsonantsRu = /[бвгджзйклмнпрстфхцчшщ]{5,}/i; // Уменьшил до 5 для лучшего отлова

        if (smashPattern.test(cleaned) || manyConsonantsEn.test(cleaned) || manyConsonantsRu.test(cleaned)) {
            return 'Пожалуйста, введите без случайных наборов букв';
        }

        const uniqueChars = new Set(cleaned.toLowerCase().replace(/\s/g, '').split('')).size;
        if (cleaned.length >= 5 && uniqueChars <= 2) {
            return 'Пожалуйста, введите осмысленное название';
        }

        return null; // Валидно
    };

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskValue, setNewTaskValue] = useState(10);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [deletingTask, setDeletingTask] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [editingTaskCategory, setEditingTaskCategory] = useState(null);

    const editTaskCategory = useStore(state => state.editTaskCategory);

    const handleToggle = (task) => {
        toggleTask(task.id);
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || isAdding) return;

        const localError = validateInput(newTaskTitle);
        if (localError) {
            setError(localError);
            return;
        }

        setIsAdding(true);
        setError('');
        try {
            const apiKey = useStore.getState().apiKey;
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

            const resp = await fetch('/api/validate', {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: newTaskTitle.trim(), type: 'task' })
            });
            const data = await resp.json();
            if (!data.valid) {
                setError(data.reason || 'Некорректный ввод');
                setIsAdding(false);
                return;
            }
        } catch (err) {
            // При ошибке сети — пропускаем валидацию
        }
        setIsAdding(false);
        addTask(newTaskTitle, Number(newTaskValue), selectedCategory);
        setNewTaskTitle('');
        setNewTaskValue(10);
        setSelectedCategory(null);
        setShowCategoryMenu(false);
    };

    const confirmDelete = (e) => {
        e.preventDefault();
        deleteTaskWithReason(deletingTask.id, deleteReason || 'Без причины');
        setDeletingTask(null);
        setDeleteReason('');
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = tasks.findIndex((t) => t.id === active.id);
            const newIndex = tasks.findIndex((t) => t.id === over.id);
            reorderTasks(oldIndex, newIndex);
        }
    };

    const filteredTasks = activeFilter === 'all'
        ? tasks
        : tasks.filter(t => activeFilter === 'uncategorized' ? !t.category : t.category === activeFilter);

    // Только используемые категории для фильтров
    const usedCategories = [...new Set(tasks.map(t => t.category).filter(Boolean))];

    return (
        <div className="flex flex-col h-full relative">
            {usedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 px-1 pb-2 border-b border-white/5">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                    >
                        Все ({tasks.length})
                    </button>
                    {usedCategories.map(catId => {
                        const cat = TASK_CATEGORIES.find(c => c.id === catId);
                        if (!cat) return null;
                        return (
                            <button
                                key={catId}
                                onClick={() => setActiveFilter(catId)}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors border border-current/20 ${activeFilter === catId ? `${cat.bg} ${cat.color} ring-1 ring-current` : `bg-white/5 ${cat.color} opacity-70 hover:opacity-100`}`}
                            >
                                {cat.name} ({tasks.filter(t => t.category === catId).length})
                            </button>
                        );
                    })}
                    {tasks.some(t => !t.category) && (
                        <button
                            onClick={() => setActiveFilter('uncategorized')}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${activeFilter === 'uncategorized' ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                        >
                            Без категории ({tasks.filter(t => !t.category).length})
                        </button>
                    )}
                </div>
            )}

            <div id="tour-task-list" className="flex-1 overflow-y-auto flex flex-col gap-3 mb-6 pr-2 pb-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={filteredTasks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {filteredTasks.map((task, index) => (
                            <SortableTaskItem
                                key={task.id}
                                task={task}
                                index={index}
                                handleToggle={handleToggle}
                                setDeletingTask={setDeletingTask}
                                setEditingTaskCategory={setEditingTaskCategory}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
                {filteredTasks.length === 0 && (
                    <div className="text-center text-text-secondary py-8 flex items-center justify-center flex-col gap-2">
                        <Check size={48} className="opacity-20" />
                        <p>{activeFilter === 'all' ? 'На сегодня задач нет. Отличный повод расслабиться!' : 'В этой категории задач нет.'}</p>
                    </div>
                )}
            </div>

            {showCategoryMenu && (
                <div className="absolute bottom-[52px] left-0 right-0 z-50 bg-[#13131A] backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-wrap gap-2 animate-fade-in">
                    <button
                        type="button"
                        onClick={() => { setSelectedCategory(null); setShowCategoryMenu(false); }}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!selectedCategory ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                    >
                        Без категории
                    </button>
                    {TASK_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => { setSelectedCategory(cat.id); setShowCategoryMenu(false); }}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border border-current/20 flex items-center gap-1.5 ${selectedCategory === cat.id ? `${cat.bg} ${cat.color} ring-1 ring-current` : `bg-white/5 ${cat.color} opacity-70 hover:opacity-100`}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {editingTaskCategory && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setEditingTaskCategory(null)} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#13131A] backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)] w-[90%] max-w-[300px] flex flex-col gap-3 animate-fade-in">
                        <h4 className="text-sm font-bold text-white mb-1">Изменить категорию</h4>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => { if (editTaskCategory) editTaskCategory(editingTaskCategory, null); setEditingTaskCategory(null); }}
                                className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors bg-white/5 text-text-secondary hover:bg-white/20 hover:text-white"
                            >
                                Без категории
                            </button>
                            {TASK_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => { if (editTaskCategory) editTaskCategory(editingTaskCategory, cat.id); setEditingTaskCategory(null); }}
                                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border border-current/20 flex items-center gap-1.5 bg-white/5 ${cat.color} opacity-80 hover:opacity-100 hover:ring-1 hover:ring-current`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <form id="tour-add-task" onSubmit={handleAddTask} className="mt-auto flex flex-col gap-1 relative z-30">
                <div className="flex gap-2 items-stretch h-[42px] sm:h-[46px]">
                    <div className="relative flex-[3] flex border border-[rgba(255,255,255,0.1)] rounded-md focus-within:border-accent transition-colors bg-[rgba(255,255,255,0.05)]">
                        <input
                            type="text"
                            placeholder="Новая задача..."
                            className="w-full bg-transparent px-3 sm:px-4 text-sm sm:text-base text-text-primary outline-none"
                            value={useStore(state => state.tourDemoTaskText) || newTaskTitle}
                            onChange={(e) => { setNewTaskTitle(e.target.value); setError(''); }}
                            readOnly={!!useStore(state => state.tourDemoTaskText)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                            className="px-2 border-l border-[rgba(255,255,255,0.1)] hover:bg-white/5 transition-colors flex flex-col justify-center gap-0.5 items-center w-12 group/catbtn relative"
                        >
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1b1b22] text-white text-[11px] font-medium py-1.5 px-3 rounded-lg opacity-0 pointer-events-none group-hover/catbtn:opacity-100 transition-opacity whitespace-nowrap shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-white/10 z-50">Выбрать категорию</div>
                            {selectedCategory ? (
                                (() => {
                                    const cat = TASK_CATEGORIES.find(c => c.id === selectedCategory);
                                    return <div className={`w-3 h-3 rounded-full ${cat?.bg} border ${cat?.color} border-current`} />
                                })()
                            ) : (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-text-secondary" />
                                    <div className="w-1 h-1 rounded-full bg-text-secondary" />
                                    <div className="w-1 h-1 rounded-full bg-text-secondary" />
                                </>
                            )}
                        </button>
                    </div>
                    <input
                        type="number"
                        className="flex-shrink-0 w-14 sm:w-20 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-md px-1 sm:px-2 text-sm sm:text-base text-text-primary outline-none focus:border-accent transition-colors text-center"
                        value={newTaskValue}
                        onChange={(e) => setNewTaskValue(e.target.value)}
                        min="1"
                    />
                    <button type="submit" disabled={isAdding} className="btn-primary flex-shrink-0 flex items-center justify-center px-3 sm:px-4 rounded-md disabled:opacity-50">
                        {isAdding ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={20} />}
                    </button>
                </div>
                {error && (
                    <p className="text-xs text-danger animate-fade-in absolute -bottom-5">{error}</p>
                )}
            </form>

            {/* Delete Task Modal */}
            {deletingTask && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-lg animate-fade-in">
                    <div className="bg-bg-secondary border border-border p-6 rounded-xl w-full max-w-sm shadow-xl">
                        <h3 className="font-bold text-lg text-white mb-2">Удаление задачи</h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Почему вы решили отменить задачу <span className="text-white font-medium">"{deletingTask.title}"</span>? Эта информация поможет Nova скорректировать ваш план.
                        </p>

                        <form onSubmit={confirmDelete}>
                            <textarea
                                className="w-full bg-black/40 border border-border rounded-lg p-3 text-sm text-white focus:border-danger focus:ring-1 focus:ring-danger outline-none mb-4 resize-none h-24"
                                placeholder="Например: Понял, что это сейчас не в приоритете..."
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                autoFocus
                            />

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setDeletingTask(null); setDeleteReason(''); }}
                                    className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 rounded-lg bg-danger text-white hover:bg-danger/80 transition-colors text-sm font-medium shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                >
                                    Удалить
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
