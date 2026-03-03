import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Check, Trash2, Zap, ChevronsUpDown } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
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

function SortableTaskItem({ task, index, handleToggle, setDeletingTask, isDragOverlay }) {
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
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={isDragOverlay ? undefined : style}
            className={`glass-card p-4 flex items-center justify-between group origin-center ${task.completed ? 'opacity-50' : ''} ${isDragOverlay ? 'shadow-[0_15px_30px_rgba(0,0,0,0.5)] border-accent/80 scale-[1.03] rotate-1 ring-2 ring-accent/60 bg-bg-card z-50' : ''}`}
        >
            <div className="flex items-center gap-3 flex-1">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-text-secondary hover:text-white p-1.5 hover:bg-white/5 rounded-md transition-colors mt-0.5 outline-none touch-none" title="Перетащить">
                    <ChevronsUpDown size={16} />
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
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-warning font-bold">
                    <Zap size={16} />
                    +{task.value}
                </div>
                {!task.completed && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setDeletingTask(task); }}
                        className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Удалить задачу"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
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
    const [deletingTask, setDeletingTask] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [activeId, setActiveId] = useState(null);

    const handleToggle = (task) => {
        toggleTask(task.id);
        if (!task.completed) {
            addTokens(task.value);
        }
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
        addTask(newTaskTitle, Number(newTaskValue));
        setNewTaskTitle('');
        setNewTaskValue(10);
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

    const handleDragCancel = () => setActiveId(null);
    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
    const activeIndex = activeTask ? tasks.indexOf(activeTask) : -1;

    return (
        <div className="flex flex-col h-full relative">
            <div id="tour-task-list" className="flex-1 overflow-y-auto flex flex-col gap-3 mb-6 pr-2 pb-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext
                        items={tasks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {tasks.map((task, index) => (
                            <SortableTaskItem
                                key={task.id}
                                task={task}
                                index={index}
                                handleToggle={handleToggle}
                                setDeletingTask={setDeletingTask}
                            />
                        ))}
                    </SortableContext>
                    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                        {activeTask ? (
                            <SortableTaskItem
                                task={activeTask}
                                index={activeIndex}
                                handleToggle={() => { }}
                                setDeletingTask={() => { }}
                                isDragOverlay
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
                {tasks.length === 0 && (
                    <div className="text-center text-text-secondary py-8 flex items-center justify-center flex-col gap-2">
                        <Check size={48} className="opacity-20" />
                        <p>На сегодня задач нет. Отличный повод расслабиться!</p>
                    </div>
                )}
            </div>

            <form id="tour-add-task" onSubmit={handleAddTask} className="mt-auto flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        placeholder="Новая задача..."
                        className={`flex-[3] min-w-0 bg-[rgba(255,255,255,0.05)] border rounded-md px-3 sm:px-4 py-2 text-sm sm:text-base text-text-primary outline-none focus:border-accent transition-colors ${error ? 'border-danger' : 'border-[rgba(255,255,255,0.1)]'}`}
                        value={useStore(state => state.tourDemoTaskText) || newTaskTitle}
                        onChange={(e) => { setNewTaskTitle(e.target.value); setError(''); }}
                        readOnly={!!useStore(state => state.tourDemoTaskText)}
                    />
                    <input
                        type="number"
                        className="flex-shrink-0 w-14 sm:w-20 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-md px-1 sm:px-2 py-2 text-sm sm:text-base text-text-primary outline-none focus:border-accent transition-colors text-center"
                        value={newTaskValue}
                        onChange={(e) => setNewTaskValue(e.target.value)}
                        min="1"
                    />
                    <button type="submit" disabled={isAdding} className="btn-primary flex-shrink-0 flex items-center justify-center p-2 sm:p-3 rounded-md disabled:opacity-50">
                        {isAdding ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={20} />}
                    </button>
                </div>
                {error && (
                    <p className="text-xs text-danger animate-fade-in">{error}</p>
                )}
            </form>

            {/* Delete Task Modal */}
            {deletingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-lg animate-fade-in">
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
