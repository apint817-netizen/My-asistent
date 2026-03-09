import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Gift, Plus, ShoppingBag, RotateCcw, Check, Trash2, Edit2 } from 'lucide-react';

export default function RewardStore() {
    const rewards = useStore(state => state.rewards);
    const addReward = useStore(state => state.addReward);
    const tokens = useStore(state => state.tokens);
    const spendTokens = useStore(state => state.spendTokens);

    const purchaseHistory = useStore(state => state.purchaseHistory);
    const addPurchase = useStore(state => state.addPurchase);
    const refundPurchase = useStore(state => state.refundPurchase);
    const usePurchase = useStore(state => state.usePurchase);
    const addMessage = useStore(state => state.addChatMessage);
    const addToast = useStore(state => state.addToast);

    const [newRewardTitle, setNewRewardTitle] = useState('');
    const [newRewardCost, setNewRewardCost] = useState(100);
    const [activeTab, setActiveTab] = useState('store'); // 'store' | 'history'

    const [refundModal, setRefundModal] = useState({ isOpen: false, purchaseId: null, reason: '' });
    const [deleteRewardModal, setDeleteRewardModal] = useState({ isOpen: false, reward: null, reason: '' });
    const [editingReward, setEditingReward] = useState(null); // id награды которую редактируем

    const deleteRewardWithReason = useStore(state => state.deleteRewardWithReason);
    const updateReward = useStore(state => state.updateReward); // Нужно будет добавить в стор если нет

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

    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAddReward = async (e) => {
        e.preventDefault();
        if (!newRewardTitle.trim() || newRewardCost <= 0 || isAdding) return;

        const localError = validateInput(newRewardTitle);
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
                body: JSON.stringify({ text: newRewardTitle.trim(), type: 'reward' })
            });
            const data = await resp.json();
            if (!data.valid) {
                setError(data.reason || 'Некорректный ввод');
                setIsAdding(false);
                return;
            }
        } catch (err) {
            // При ошибке сети — пропускаем
        }
        setIsAdding(false);
        addReward({ title: newRewardTitle, cost: Number(newRewardCost) });
        setNewRewardTitle('');
        setNewRewardCost(100);
    };

    const handleBuy = (reward) => {
        if (tokens >= reward.cost) {
            spendTokens(reward.cost);
            addPurchase(reward);
            addMessage({
                role: 'system',
                content: `Вы потратили ${reward.cost} очков на "${reward.title}". Наслаждайтесь!`
            });
            addToast(`Награда "${reward.title}" куплена!`, "success");
            // Optionally switch to history tab so they see their purchase
            // setActiveTab('history');
        } else {
            addToast('Недостаточно очков!', 'error');
        }
    };

    const handleRefundSubmit = (e) => {
        e.preventDefault();
        const finalReason = refundModal.reason.trim() || 'Без причины';

        refundPurchase(refundModal.purchaseId, finalReason);

        addMessage({
            role: 'system',
            content: `Покупка отменена. Причина: "${finalReason}". Очки возвращены на баланс.`
        });
        addToast(`Очки за покупку возвращены`, "info");

        setRefundModal({ isOpen: false, purchaseId: null, reason: '' });
    };

    const activePurchases = purchaseHistory.filter(p => p.status === 'active');
    const pastPurchases = purchaseHistory.filter(p => p.status !== 'active');

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex bg-black/20 rounded-lg p-1 mb-6">
                <button
                    onClick={() => setActiveTab('store')}
                    className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm rounded-md transition-all font-medium ${activeTab === 'store' ? 'bg-bg-primary text-warning shadow-md' : 'text-text-secondary hover:text-white'}`}
                >
                    <Gift size={16} />
                    Магазин
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm rounded-md transition-all font-medium ${activeTab === 'history' ? 'bg-bg-primary text-blue-400 shadow-md' : 'text-text-secondary hover:text-white'}`}
                >
                    <ShoppingBag size={16} />
                    Мои покупки {activePurchases.length > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{activePurchases.length}</span>}
                </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-0 md:pr-2 custom-scrollbar">
                {activeTab === 'store' && (
                    <>
                        {/* Horizontal scroll on mobile, vertical grid on desktop */}
                        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto md:overflow-x-visible no-scrollbar snap-x snap-mandatory pb-2">
                            {rewards.map((reward) => (
                                <div key={reward.id} className="relative group shrink-0 md:shrink snap-center w-[110px] min-w-[110px] md:w-auto md:min-w-0">
                                    <div className="h-full">
                                        <button
                                            onClick={() => handleBuy(reward)}
                                            disabled={tokens < reward.cost}
                                            className="w-full bg-black/20 border border-border p-2 md:p-4 rounded-xl flex flex-col items-center justify-between gap-1 md:gap-2 hover:border-warning/50 hover:bg-warning/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed h-[140px] md:h-auto shadow-sm"
                                        >
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                                                <Gift size={16} className="md:w-5 md:h-5" />
                                            </div>
                                            <span className="font-semibold text-center leading-tight text-xs md:text-sm line-clamp-3 w-full flex-1 flex items-center justify-center">{reward.title}</span>
                                            <span className="text-warning text-[11px] md:text-sm font-bold bg-warning/10 px-2 py-0.5 md:px-3 md:py-1 rounded-full whitespace-nowrap mt-auto shrink-0">
                                                {reward.cost} ⚡
                                            </span>
                                        </button>
                                        {/* Edit/Delete — always visible on mobile, hover on desktop */}
                                        <div className="flex justify-center gap-1 mt-1 md:absolute md:top-2 md:right-2 md:mt-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingReward(reward); setNewRewardTitle(reward.title); setNewRewardCost(reward.cost); }}
                                                className="p-1.5 rounded-md text-text-secondary active:text-accent active:bg-accent/10 md:hover:text-accent md:hover:bg-accent/10 transition-all"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteRewardModal({ isOpen: true, reward, reason: '' }); }}
                                                className="p-1.5 rounded-md text-text-secondary active:text-red-400 active:bg-red-500/10 md:hover:text-red-400 md:hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-6">
                        {/* Active Purchases */}
                        <div>
                            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Доступно к использованию</h4>
                            {activePurchases.length === 0 ? (
                                <p className="text-sm text-text-secondary italic bg-black/20 p-4 rounded-xl text-center">Нет активных наград.</p>
                            ) : (
                                <div className="space-y-3">
                                    {activePurchases.map(p => (
                                        <div key={p.purchaseId} className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-blue-100">{p.title}</p>
                                                    <p className="text-xs text-blue-300/70 mt-1">{new Date(p.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                </div>
                                                <span className="text-xs font-bold bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md">-{p.cost}</span>
                                            </div>

                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => usePurchase(p.purchaseId)}
                                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <Check size={14} /> Использовать
                                                </button>
                                                <button
                                                    onClick={() => setRefundModal({ isOpen: true, purchaseId: p.purchaseId, reason: '' })}
                                                    className="flex-1 bg-black/40 hover:bg-red-500/20 text-text-secondary hover:text-red-400 border border-transparent hover:border-red-500/30 text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <RotateCcw size={14} /> Отменить
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Past Purchases */}
                        {pastPurchases.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Архив</h4>
                                <div className="space-y-2 opacity-70">
                                    {pastPurchases.map(p => (
                                        <div key={p.purchaseId} className="bg-black/20 border border-border px-3 py-2 rounded-lg flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-text-secondary line-through decoration-text-secondary/50">{p.title}</p>
                                                {p.status === 'refunded' && (
                                                    <p className="text-[10px] text-red-400 mt-0.5">Возврат: {p.refundReason}</p>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${p.status === 'refunded' ? 'bg-red-500/10 text-red-400' : 'bg-success/10 text-success'}`}>
                                                {p.status === 'refunded' ? 'Отменено' : 'Использовано'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {activeTab === 'store' && (
                <form onSubmit={handleAddReward} className="mt-6 flex flex-col gap-1 shrink-0 pb-2">
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            placeholder={editingReward ? "Название..." : "Новая награда..."}
                            className={`flex-[3] min-w-0 bg-black/40 border rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base outline-none focus:border-warning focus:ring-1 focus:ring-warning transition-all placeholder:text-text-secondary ${error ? 'border-danger' : 'border-border'}`}
                            value={newRewardTitle}
                            onChange={(e) => { setNewRewardTitle(e.target.value); setError(''); }}
                        />
                        <input
                            type="number"
                            min="1"
                            className="flex-shrink-0 w-14 sm:w-20 bg-black/40 border border-border rounded-lg px-1 sm:px-2 py-2 text-sm sm:text-base outline-none focus:border-warning focus:ring-1 focus:ring-warning transition-all"
                            value={newRewardCost}
                            onChange={(e) => setNewRewardCost(e.target.value)}
                        />
                        {editingReward ? (
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => { setEditingReward(null); setNewRewardTitle(''); setNewRewardCost(100); }}
                                    className="bg-black/40 border border-border text-text-secondary p-2 sm:p-3 rounded-lg hover:text-white transition-all flex items-center justify-center font-bold"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={() => {
                                        updateReward(editingReward.id, { title: newRewardTitle, cost: Number(newRewardCost) });
                                        setEditingReward(null);
                                        setNewRewardTitle('');
                                        setNewRewardCost(100);
                                        addToast('Награда обновлена', 'success');
                                    }}
                                    className="bg-accent/20 border border-accent/30 text-accent p-2 sm:p-3 rounded-lg hover:bg-accent/30 transition-all flex items-center justify-center font-bold"
                                >
                                    ОК
                                </button>
                            </div>
                        ) : (
                            <button
                                type="submit"
                                disabled={!newRewardTitle.trim() || isAdding}
                                className="flex-shrink-0 bg-bg-primary border border-border text-white p-2 sm:p-3 rounded-lg hover:bg-black/60 hover:text-warning hover:border-warning/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isAdding ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={20} />}
                            </button>
                        )}
                    </div>
                    {error && (
                        <p className="text-xs text-danger animate-fade-in">{error}</p>
                    )}
                </form>
            )}

            {/* Refund Modal */}
            {refundModal.isOpen && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-xl">
                    <div className="bg-bg-secondary border border-border p-5 rounded-2xl w-full shadow-2xl animate-fade-in text-center">
                        <h3 className="font-bold text-lg mb-2">Отмена покупки</h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Чтобы вернуть очки, укажите причину отказа от награды. Будьте честны с собой!
                        </p>
                        <form onSubmit={handleRefundSubmit}>
                            <textarea
                                autoFocus
                                placeholder="Я передумал, потому что..."
                                className="w-full bg-black/40 border border-border rounded-lg p-3 text-sm min-h-[80px] outline-none focus:border-red-400 transition-colors mb-4 resize-none"
                                value={refundModal.reason}
                                onChange={(e) => setRefundModal({ ...refundModal, reason: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRefundModal({ isOpen: false, purchaseId: null, reason: '' })}
                                    className="flex-1 py-2 rounded-lg bg-black/40 hover:bg-black/60 text-text-secondary transition-colors text-sm font-medium"
                                >
                                    Оставить
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-bold shadow-lg shadow-red-500/20"
                                >
                                    Вернуть очки
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Reward Modal */}
            {deleteRewardModal.isOpen && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-lg animate-fade-in">
                    <div className="bg-bg-secondary border border-border p-6 rounded-xl w-full max-w-sm shadow-xl">
                        <h3 className="font-bold text-lg text-white mb-2">Удаление награды</h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Почему вы решили удалить награду <span className="text-white font-medium">"{deleteRewardModal.reward?.title}"</span>?
                        </p>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            deleteRewardWithReason(deleteRewardModal.reward.id, deleteRewardModal.reason.trim() || 'Без причины');
                            setDeleteRewardModal({ isOpen: false, reward: null, reason: '' });
                            addToast(`Награда удалена из магазина`, "info");
                        }}>
                            <textarea
                                className="w-full bg-black/40 border border-border rounded-lg p-3 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none mb-4 resize-none h-24"
                                placeholder="Например: Больше не актуально..."
                                value={deleteRewardModal.reason}
                                onChange={(e) => setDeleteRewardModal({ ...deleteRewardModal, reason: e.target.value })}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteRewardModal({ isOpen: false, reward: null, reason: '' })}
                                    className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium shadow-[0_0_15px_rgba(239,68,68,0.3)]"
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
