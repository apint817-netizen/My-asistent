import { useStore } from '../store/useStore';
import { Target, Check, X } from 'lucide-react';

export default function TaskProposalModal() {
    const taskProposals = useStore(state => state.taskProposals);
    const calendarProposals = useStore(state => state.calendarProposals);

    const approveTask = useStore(state => state.approveProposal);
    const rejectTask = useStore(state => state.rejectProposal);

    const approveCalendar = useStore(state => state.approveCalendarProposal);
    const rejectCalendar = useStore(state => state.rejectCalendarProposal);

    const hasCalendar = calendarProposals && calendarProposals.length > 0;
    const hasTask = taskProposals && taskProposals.length > 0;

    if (!hasCalendar && !hasTask) return null;

    const isCalendar = hasCalendar;
    const current = isCalendar ? calendarProposals[0] : taskProposals[0];
    const approve = isCalendar ? approveCalendar : approveTask;
    const reject = isCalendar ? rejectCalendar : rejectTask;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-bg-secondary border border-border p-6 rounded-xl w-full max-w-sm shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-lg">
                        <Target size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white leading-tight">Nova предлагает цель</h3>
                        <p className="text-xs text-text-secondary">Основано на нашем диалоге</p>
                    </div>
                </div>

                <div className="bg-black/30 border border-border/50 rounded-lg p-4 mb-6 relative z-10">
                    <p className="text-white font-medium text-lg leading-snug mb-2">{current.title}</p>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 text-warning text-xs font-bold rounded-md border border-warning/20">
                            +{current.points} очк.
                        </div>
                        {isCalendar && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 text-accent text-xs font-bold rounded-md border border-accent/20">
                                Запланировано на: {current.date}
                            </div>
                        )}
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
                        className="flex-1 py-2.5 rounded-lg bg-success text-bg-primary hover:bg-success/90 transition-all text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                        <Check size={16} /> Принять
                    </button>
                </div>
            </div>
        </div>
    );
}
