import { useState, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppDatePicker } from "@/components/ui/app-date-pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { useAccountsContext } from "@/contexts/AccountsContext";
import { useTransactionsContext } from "@/contexts/TransactionsContext";
import { toast } from "sonner";
import { toISO } from "@/lib/datetime";

type PayoutModalProps = { open: boolean; onClose: () => void };

export function PayoutModal({ open, onClose }: PayoutModalProps) {
  const { challenges } = useChallengesContext();
  const { getAccountsByChallengeId } = useAccountsContext();
  const { addTransaction } = useTransactionsContext();

  const [challengeId, setChallengeId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (open) {
      setChallengeId("");
      setAmount("");
      setDate(new Date());
    }
  }, [open]);

  const challenge = useMemo(() => challenges.find(c => c.challengeId === challengeId), [challenges, challengeId]);
  const valid = !!challenge && Number(amount) > 0 && !!date;

  const handleAdd = () => {
    if (!valid || !challenge || !date) return;
    const accts = getAccountsByChallengeId(challenge.challengeId);
    const fundedAcct = accts.find(a => a.step === 'funded');
    addTransaction({
      type: 'income',
      category: 'payout',
      amount: Number(amount),
      challengeId: challenge.challengeId,
      accountId: fundedAcct?.id,
      firm: challenge.firm,
      status: 'reviewed',
      date: toISO(date),
      description: `Payout — ${challenge.nickname}`,
    });
    toast.success("Payout recorded");
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card rounded-2xl shadow-xl w-full max-w-[520px] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-7 pt-6 pb-5">
            <h2 className="text-xl font-bold text-foreground">Payouts</h2>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-7 pb-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Account (Challenge)</label>
              <Select value={challengeId} onValueChange={setChallengeId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select a challenge" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {challenges.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No challenges available</div>
                  ) : challenges.map(c => (
                    <SelectItem key={c.challengeId} value={c.challengeId}>{c.nickname} — {c.firm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-11 pl-7" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Date</label>
              <AppDatePicker value={date} onChange={setDate} />
            </div>
          </div>
          <div className="flex items-center justify-between px-7 py-4 border-t border-border">
            <button onClick={onClose} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={!valid} className={cn("px-5 py-2 text-sm font-medium rounded-lg transition-colors", valid ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed")}>Add payout</button>
          </div>
        </div>
      </div>
    </>
  );
}
