import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Trash2, ArrowUpRight, ArrowDownRight, RefreshCcw, Trophy } from 'lucide-react';

export default function PointsHistoryModal({ isOpen, onClose }) {
    const tokens = useStore(state => state.tokens);
    const pointsHistory = useStore(state => state.pointsHistory || []);
    const resetTokens = useStore(state => state.resetTokens);
    const clearPointsHistory = useStore(state => state.clearPointsHistory);
    const addToast = useStore(state => state.addToast);

    const [showConfirmReset, setShowConfirmReset] = useState(false);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' | 'earn' | 'spend'

    if (!isOpen) return null;

    const filteredHistory = pointsHistory.filter(item => filter === 'all' ? true : filter === 'earn' ? item.type === 'earn' : (item.type === 'spend' || item.type === 'reset'));

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6 animate-fade-in bg-black/60 backdrop-blur-md">
            <div id="tour-points-modal-override" className="bg-bg-primary/95 md:bg-bg-secondary w-full md:max-w-lg shadow-2xl flex flex-col relative overflow-hidden max-h-[90vh] md:max-h-[85vh] rounded-t-3xl md:rounded-2xl animate-slide-up md:animate-scale-in border-t border-white/5 md:border md:border-border">
                {/* Mobile Drag Indicator */}
                <div className="w-full flex justify-center pt-3 pb-1 md:hidden shrink-0 pointer-events-none absolute top-0 left-0 right-0 z-50">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div className="p-4 md:p-6 pb-4 pt-8 md:pt-6 border-b border-border flex items-center justify-between relative z-10 bg-transparent md:bg-bg-secondary/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center text-warning shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">Ваши очки</h2>
                            <p className="text-sm text-text-secondary">Текущий баланс: {tokens}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-white">История баланса</h3>
                        {pointsHistory.length > 0 && (
                            <button
                                onClick={() => setShowConfirmClear(true)}
                                className="text-xs flex items-center gap-1 text-text-secondary hover:text-danger bg-white/5 hover:bg-danger/10 px-2 py-1.5 rounded-md transition-colors border border-white/5 hover:border-danger/30"
                            >
                                <Trash2 size={12} />
                                Очистить лог
                            </button>
                        )}
                    </div>

                    {pointsHistory.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                            >
                                Все
                            </button>
                            <button
                                onClick={() => setFilter('earn')}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${filter === 'earn' ? 'bg-success/20 text-success ring-1 ring-success' : 'bg-white/5 text-text-secondary hover:bg-success/10 hover:text-success'}`}
                            >
                                Заработано
                            </button>
                            <button
                                onClick={() => setFilter('spend')}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${filter === 'spend' ? 'bg-danger/20 text-danger ring-1 ring-danger' : 'bg-white/5 text-text-secondary hover:bg-danger/10 hover:text-danger'}`}
                            >
                                Потрачено
                            </button>
                        </div>
                    )}

                    {pointsHistory.length === 0 ? (
                        <div className="text-center text-text-secondary py-8 flex flex-col items-center gap-2">
                            <Trophy size={48} className="opacity-20 mb-2" />
                            <p>История пуста.</p>
                            <p className="text-sm">Выполняйте задачи, чтобы заработать первые очки!</p>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="text-center text-text-secondary py-8">
                            <p>В этой категории нет записей.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredHistory.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-bg-primary border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'earn' ? 'bg-success/20 text-success' :
                                            item.type === 'spend' ? 'bg-danger/20 text-danger' :
                                                'bg-warning/20 text-warning'
                                            }`}>
                                            {item.type === 'earn' ? <ArrowUpRight size={16} /> :
                                                item.type === 'spend' ? <ArrowDownRight size={16} /> :
                                                    <RefreshCcw size={16} />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white text-sm">{item.title}</span>
                                            <span className="text-xs text-text-secondary">
                                                {new Date(item.date).toLocaleString('ru-RU', {
                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`font-bold ${item.type === 'earn' ? 'text-success' :
                                        item.type === 'spend' ? 'text-danger' :
                                            'text-warning'
                                        }`}>
                                        {item.type === 'earn' ? '+' : item.type === 'spend' ? '-' : ''}{item.amount}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Danger Zone */}
                <div className="p-6 border-t border-border bg-black/20">
                    <button
                        type="button"
                        onClick={() => setShowConfirmReset(true)}
                        className="w-full bg-error text-white hover:bg-red-600 px-4 py-3 rounded-xl text-sm transition-colors font-medium flex items-center justify-center gap-2 shadow-lg shadow-error/20"
                    >
                        <Trash2 size={16} />
                        Сбросить баланс
                    </button>
                </div>
            </div>

            {/* Модальное окно подтверждения сброса */}
            {showConfirmReset && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowConfirmReset(false)}>
                    <div className="bg-bg-secondary border border-error/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(239,68,68,0.15)] animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 size={24} className="text-error" />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2">Обнулить баланс?</h3>
                        <p className="text-text-secondary text-sm text-center mb-6">
                            Вы уверены, что хотите сбросить <strong>все ваши заработанные очки (токены)</strong> до нуля? Это действие нельзя отменить.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmReset(false)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => {
                                    resetTokens();
                                    setShowConfirmReset(false);
                                    addToast("Баланс очков успешно сброшен!", "info");
                                }}
                                className="flex-1 px-4 py-2.5 bg-error hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-error/20"
                            >
                                Да, сбросить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно подтверждения очистки истории */}
            {showConfirmClear && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowConfirmClear(false)}>
                    <div className="bg-bg-secondary border border-danger/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(239,68,68,0.15)] animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-danger/20 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 size={24} className="text-danger" />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2">Очистить историю?</h3>
                        <p className="text-text-secondary text-sm text-center mb-6">
                            Вы уверены, что хотите удалить весь лог операций? <strong>Текущий баланс очков ({tokens} ⚡) не изменится.</strong>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmClear(false)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={() => {
                                    clearPointsHistory();
                                    setShowConfirmClear(false);
                                    addToast("История операций очищена", "info");
                                }}
                                className="flex-1 px-4 py-2.5 bg-danger hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-danger/20"
                            >
                                Очистить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
