import { useStore } from '../store/useStore';
import { Gift, Check, X } from 'lucide-react';

export default function RewardProposalModal() {
    const proposals = useStore(state => state.rewardProposals);
    const approve = useStore(state => state.approveRewardProposal);
    const reject = useStore(state => state.rejectRewardProposal);

    // Only show one at a time to not overwhelm
    if (!proposals || proposals.length === 0) return null;

    const current = proposals[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-bg-secondary border-t border-white/5 md:border md:border-border p-6 pb-safe rounded-t-3xl md:rounded-xl w-full max-w-sm shadow-xl relative overflow-hidden animate-slide-up md:animate-scale-in">
                {/* Mobile Drag Indicator */}
                <div className="w-full flex justify-center pb-4 md:hidden shrink-0 pointer-events-none absolute top-3 left-0 right-0 z-50">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-warning/20 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-orange-500 flex items-center justify-center shadow-lg">
                        <Gift size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white leading-tight">Nova предлагает награду</h3>
                        <p className="text-xs text-text-secondary">Основано на нашем диалоге</p>
                    </div>
                </div>

                <div className="bg-black/30 border border-border/50 rounded-lg p-4 mb-6 relative z-10">
                    <p className="text-white font-medium text-lg leading-snug mb-2">
                        {typeof current.title === 'string' ? current.title : (current.title?.title || 'Новая награда')}
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 text-warning text-xs font-bold rounded-md border border-warning/20">
                        {current.cost} очк.
                    </div>
                </div>

                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={() => reject(current.id)}
                        className="flex-1 py-2.5 rounded-lg border border-border text-text-secondary hover:text-white hover:bg-white/5 transition-all text-sm font-semibold flex items-center justify-center gap-2"
                    >
                        <X size={16} /> Отклонить
                    </button>
                    <button
                        onClick={() => approve(current.id)}
                        className="flex-1 py-2.5 rounded-lg bg-warning text-white hover:bg-orange-500 transition-all text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    >
                        <Check size={16} /> Принять
                    </button>
                </div>
            </div>
        </div>
    );
}
