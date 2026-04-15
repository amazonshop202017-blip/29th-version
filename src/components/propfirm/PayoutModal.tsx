import { X, ChevronDown, CalendarDays } from "lucide-react";

type PayoutModalProps = { open: boolean; onClose: () => void };

export function PayoutModal({ open, onClose }: PayoutModalProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-[520px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-7 pt-6 pb-5">
            <h2 className="text-xl font-bold text-foreground">Payouts</h2>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-7 pb-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Account (Challenge)</label>
              <div className="flex items-center justify-between w-full border border-border rounded-lg px-4 py-3 bg-white cursor-pointer hover:border-foreground/30 transition-colors">
                <span className="text-sm text-muted-foreground">Select a challenge</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Amount</label>
              <div className="flex items-center w-full border border-border rounded-lg px-4 py-3 bg-white">
                <span className="text-sm text-muted-foreground">$</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Date</label>
              <div className="flex items-center justify-between w-full border border-border rounded-lg px-4 py-3 bg-white">
                <span className="text-sm text-muted-foreground">MM/DD/YYYY</span>
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-7 py-4 border-t border-border">
            <button onClick={onClose} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Cancel</button>
            <button disabled className="px-5 py-2 text-sm font-medium rounded-lg bg-muted text-muted-foreground cursor-not-allowed">Add payout</button>
          </div>
        </div>
      </div>
    </>
  );
}
