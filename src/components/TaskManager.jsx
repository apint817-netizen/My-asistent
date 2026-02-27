import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Check, Trash2, Zap, GripVertical } from 'lucide-react';
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
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

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
            className={`glass-card p-4 flex items-center justify-between group ${task.completed ? 'opacity-50' : ''} ${isDragOverlay ? 'shadow-2xl shadow-accent/30 border-accent/50 scale-[1.02] ring-2 ring-accent/30' : ''}`}
        >
            <div className="flex items-center gap-3 flex-1">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-text-secondary hover:text-white mt-0.5 outline-none">
                    <GripVertical size={16} />
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
    const deleteTaskWithReason = useStore(state => state.deleteTaskWithReason);
    const reorderTasks = useStore(state => state.reorderTasks);

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskValue, setNewTaskValue] = useState(10);
    const [deletingTask, setDeletingTask] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [validationError, setValidationError] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [activeId, setActiveId] = useState(null);

    const handleToggle = (task) => {
        toggleTask(task.id);
        if (!task.completed) {
            addTokens(task.value);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        setValidationError('');
        setIsValidating(true);
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
                setValidationError(data.reason || 'Некорректный ввод');
                setIsValidating(false);
                return;
            }
        } catch (err) {
            // При ошибке сети — пропускаем валидацию
        }
        setIsValidating(false);
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
            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
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

            <form onSubmit={handleAdd} className="mt-auto flex flex-col gap-1">
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Новая задача..."
                        className={`flex-1 bg-[rgba(255,255,255,0.05)] border rounded-md px-4 py-2 text-text-primary outline-none focus:border-accent transition-colors ${validationError ? 'border-danger' : 'border-[rgba(255,255,255,0.1)]'}`}
                        value={newTaskTitle}
                        onChange={(e) => { setNewTaskTitle(e.target.value); setValidationError(''); }}
                    />
                    <input
                        type="number"
                        className="w-20 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-md px-2 py-2 text-text-primary outline-none focus:border-accent transition-colors text-center"
                        value={newTaskValue}
                        onChange={(e) => setNewTaskValue(e.target.value)}
                        min="1"
                    />
                    <button type="submit" disabled={isValidating} className="btn-primary flex items-center justify-center p-3 rounded-md disabled:opacity-50">
                        {isValidating ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={20} />}
                    </button>
                </div>
                {validationError && (
                    <p className="text-xs text-danger animate-fade-in">{validationError}</p>
                )}
            </form>

            {/* Delete Task Modal */}
            {deletingTask && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-lg animate-fade-in">
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
