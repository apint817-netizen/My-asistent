import { useState, useEffect } from 'react';
import { useStore, TASK_CATEGORIES } from '../store/useStore';
import { Plus, Check, ArrowDownAZ } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskItem, SortableTaskItem } from './TaskItem';
import EditTaskModal from './EditTaskModal';

const restrictToVerticalAxis = ({ transform }) => {
    return {
        ...transform,
        x: 0,
    };
};

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
    const [activeId, setActiveId] = useState(null);

    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [editingTaskCategory, setEditingTaskCategory] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const [sortOrder, setSortOrder] = useState('manual');

    const editTaskCategory = useStore(state => state.editTaskCategory);

    useEffect(() => {
        if (activeFilter !== 'all' && activeFilter !== 'uncategorized') {
            setSelectedCategory(activeFilter);
        }
    }, [activeFilter]);

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

            const baseUrl = import.meta.env.VITE_API_URL || '';
            const resp = await fetch(`${baseUrl}/api/validate`, {
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
        })
    );

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        setActiveId(null);
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = tasks.findIndex((t) => t.id === active.id);
            const newIndex = tasks.findIndex((t) => t.id === over.id);
            reorderTasks(oldIndex, newIndex);
        }
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const activeTask = activeId ? filteredTasks.find(t => t.id === activeId) : null;

    let filteredTasks = activeFilter === 'all'
        ? tasks
        : tasks.filter(t => activeFilter === 'uncategorized' ? !t.category : t.category === activeFilter);

    if (sortOrder === 'points') {
        filteredTasks = [...filteredTasks].sort((a, b) => b.value - a.value);
    } else if (sortOrder === 'category') {
        filteredTasks = [...filteredTasks].sort((a, b) => {
            const cA = a.category || 'z';
            const cB = b.category || 'z';
            return cA.localeCompare(cB);
        });
    }

    // Только используемые категории для фильтров
    const usedCategories = [...new Set(tasks.map(t => t.category).filter(Boolean))];

    return (
        <div className="flex flex-col h-full relative">
            {usedCategories.length > 0 && (
                <div className="flex items-center gap-2 mb-4 px-2 py-2 -mx-1 border-b border-white/5 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-1 mr-2">
                        <ArrowDownAZ size={14} className="text-text-secondary" />
                        <select 
                            className="text-xs bg-transparent text-text-secondary outline-none appearance-none cursor-pointer font-medium"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="manual">Мой порядок</option>
                            <option value="points">По стоимости</option>
                            <option value="category">По категориям</option>
                        </select>
                    </div>
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
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
                    <SortableContext
                        items={filteredTasks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                        disabled={sortOrder !== 'manual'}
                    >
                        {filteredTasks.map((task, index) => (
                            <SortableTaskItem
                                key={task.id}
                                task={task}
                                index={index}
                                handleToggle={handleToggle}
                                setDeletingTask={setDeletingTask}
                                setEditingTaskCategory={setEditingTaskCategory}
                                setEditingTask={setEditingTask}
                            />
                        ))}
                    </SortableContext>
                    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                        {activeTask ? (
                            <TaskItem
                                task={activeTask}
                                index={0}
                                handleToggle={() => { }}
                                isDragOverlay={true}
                                attributes={{}}
                                listeners={{}}
                                style={{}}
                                setNodeRef={() => { }}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
                {filteredTasks.length === 0 && (
                    <div className="text-center text-text-secondary py-8 flex items-center justify-center flex-col gap-2">
                        <Check size={48} className="opacity-20" />
                        <p>{activeFilter === 'all' ? 'На сегодня задач нет. Отличный повод расслабиться!' : 'В этой категории задач нет.'}</p>
                    </div>
                )}
            </div>

            {editingTask && <EditTaskModal task={editingTask} onClose={() => setEditingTask(null)} />}

            {showCategoryMenu && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none animate-fade-in" onClick={() => setShowCategoryMenu(false)} />
                    <div className="fixed md:absolute bottom-0 md:bottom-[52px] left-0 right-0 z-50 bg-[#13131A] md:bg-[#13131A] backdrop-blur-3xl md:backdrop-blur-xl border-t md:border border-white/10 rounded-t-3xl md:rounded-xl p-4 md:p-4 pb-safe md:pb-4 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] md:shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-wrap gap-2 animate-slide-up md:animate-fade-in">
                        {/* Mobile Drag Indicator */}
                        <div className="w-full flex justify-center pb-3 md:hidden shrink-0 pointer-events-none absolute top-2 left-0 right-0">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                        </div>
                        <button type="button" onClick={() => setShowCategoryMenu(false)} className="absolute top-3 right-3 text-text-secondary hover:text-white p-1 bg-white/5 rounded-full hidden md:block">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                        <div className="w-full pt-4 md:pt-2 flex flex-wrap gap-2 pr-6">
                            <button
                                type="button"
                                onClick={() => { setSelectedCategory(null); setShowCategoryMenu(false); }}
                                className={`text-sm md:text-xs px-4 py-2 md:py-1.5 rounded-full font-medium transition-colors ${!selectedCategory ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                            >
                                Без категории
                            </button>
                            {TASK_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => { setSelectedCategory(cat.id); setShowCategoryMenu(false); }}
                                    className={`text-sm md:text-xs px-4 py-2 md:py-1.5 rounded-full font-medium transition-colors border border-current/20 flex items-center gap-1.5 ${selectedCategory === cat.id ? `${cat.bg} ${cat.color} ring-1 ring-current` : `bg-white/5 ${cat.color} opacity-70 hover:opacity-100`}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {editingTaskCategory && (
                <>
                    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-md" onClick={() => setEditingTaskCategory(null)} />
                    <div className="fixed bottom-0 md:fixed md:top-1/2 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[100] bg-[#13131A] backdrop-blur-3xl md:backdrop-blur-xl border-t md:border border-white/10 rounded-t-3xl md:rounded-xl p-6 md:p-4 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] md:w-[90%] md:max-w-[300px] flex flex-col gap-4 md:gap-3 animate-slide-up md:animate-fade-in pb-safe md:pb-4">
                        {/* Mobile Drag Indicator */}
                        <div className="w-full flex justify-center pb-2 md:hidden min-h-0 pointer-events-none absolute top-3 left-0 right-0">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                        </div>
                        <h4 className="text-lg md:text-sm font-bold text-white mb-2 md:mb-1 pt-4 md:pt-0">Изменить категорию</h4>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => { if (editTaskCategory) editTaskCategory(editingTaskCategory, null); setEditingTaskCategory(null); }}
                                className="text-sm md:text-xs px-4 md:px-3 py-2 md:py-1.5 rounded-full font-medium transition-colors bg-white/5 text-text-secondary hover:bg-white/20 hover:text-white"
                            >
                                Без категории
                            </button>
                            {TASK_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => { if (editTaskCategory) editTaskCategory(editingTaskCategory, cat.id); setEditingTaskCategory(null); }}
                                    className={`text-sm md:text-xs px-4 md:px-3 py-2 md:py-1.5 rounded-full font-medium transition-colors border border-current/20 flex items-center gap-1.5 bg-white/5 ${cat.color} opacity-80 hover:opacity-100 hover:ring-1 hover:ring-current`}
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
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-md rounded-none md:rounded-lg animate-fade-in">
                    <div className="bg-bg-secondary border-t md:border border-border p-6 rounded-t-3xl md:rounded-xl w-full max-w-sm shadow-xl animate-slide-up md:animate-scale-in relative pb-safe md:pb-6">
                        {/* Mobile Drag Indicator */}
                        <div className="w-full flex justify-center pb-4 md:hidden shrink-0 pointer-events-none absolute top-3 left-0 right-0 z-50">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                        </div>
                        <h3 className="font-bold text-xl md:text-lg text-white mb-2 pt-4 md:pt-0">Удаление задачи</h3>
                        <p className="text-sm md:text-sm text-text-secondary mb-4">
                            Почему вы решили отменить задачу <span className="text-white font-medium">"{deletingTask.title}"</span>? Эта информация поможет Nova скорректировать ваш план.
                        </p>

                        <form onSubmit={confirmDelete}>
                            <textarea
                                className="w-full bg-black/40 border border-border rounded-lg p-3 text-sm md:text-sm text-white focus:border-danger focus:ring-1 focus:ring-danger outline-none mb-6 md:mb-4 resize-none h-24"
                                placeholder="Например: Понял, что это сейчас не в приоритете..."
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                autoFocus
                            />

                            <div className="flex gap-3 md:gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setDeletingTask(null); setDeleteReason(''); }}
                                    className="flex-1 px-4 py-3 md:py-2 rounded-xl md:rounded-lg border border-border text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-sm font-semibold md:font-medium"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 md:py-2 rounded-xl md:rounded-lg bg-danger text-white hover:bg-danger/80 transition-colors text-sm font-bold md:font-medium shadow-[0_0_15px_rgba(239,68,68,0.3)]"
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
