import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppDatePicker } from "@/components/ui/app-date-pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { useAccountsContext } from "@/contexts/AccountsContext";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PropFirmTransaction,
  TxCategory,
  TxStatus,
  TxType,
  useTransactionsContext,
} from "@/contexts/TransactionsContext";
import { toast } from "sonner";
import { toISO } from "@/lib/datetime";

type Props = {
  open: boolean;
  onClose: () => void;
  editing?: PropFirmTransaction | null;
};

const schema = z.object({
  type: z.enum(["income", "expense"]),
  challengeId: z.string().optional(),
  accountId: z.string().optional(),
  firm: z.string().trim().min(1, "Firm is required").max(60),
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be > 0").max(1_000_000),
  date: z.date({ required_error: "Date is required" }),
  description: z.string().max(500).optional(),
  status: z.enum(["reviewed", "not_reviewed", "ignored"]),
});

export function AddEditTransactionModal({ open, onClose, editing }: Props) {
  const { challenges } = useChallengesContext();
  const { getAccountsByChallengeId, accounts } = useAccountsContext();
  const { addTransaction, updateTransaction } = useTransactionsContext();

  const [type, setType] = useState<TxType>("expense");
  const [challengeId, setChallengeId] = useState<string | undefined>(undefined);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [firm, setFirm] = useState("");
  const [category, setCategory] = useState<TxCategory>("evaluation_fee");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TxStatus>("reviewed");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setChallengeId(editing.challengeId);
      setAccountId(editing.accountId);
      setFirm(editing.firm);
      setCategory(editing.category);
      setAmount(String(editing.amount));
      setDate(editing.date ? new Date(editing.date) : new Date());
      setDescription(editing.description || "");
      setStatus(editing.status);
    } else {
      setType("expense");
      setChallengeId(undefined);
      setAccountId(undefined);
      setFirm("");
      setCategory("evaluation_fee");
      setAmount("");
      setDate(new Date());
      setDescription("");
      setStatus("reviewed");
    }
  }, [open, editing]);

  const accountOptions = useMemo(() => {
    if (challengeId) return getAccountsByChallengeId(challengeId);
    return accounts.filter(a => a.accountMode === 'propfirm');
  }, [challengeId, accounts, getAccountsByChallengeId]);

  const categoryOptions = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Reset category if type changes to mismatched value
  useEffect(() => {
    if (!categoryOptions.includes(category)) {
      setCategory(categoryOptions[0]);
    }
  }, [type]); // eslint-disable-line

  const handleChallengeChange = (id: string) => {
    setChallengeId(id || undefined);
    const c = challenges.find(c => c.challengeId === id);
    if (c) setFirm(c.firm);
    setAccountId(undefined);
  };

  const handleSubmit = () => {
    const result = schema.safeParse({
      type,
      challengeId,
      accountId,
      firm,
      category,
      amount: Number(amount),
      date,
      description,
      status,
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message || "Invalid input");
      return;
    }
    const data = result.data;
    const payload = {
      type: data.type,
      challengeId: data.challengeId || undefined,
      accountId: data.accountId || undefined,
      firm: data.firm,
      category: data.category as TxCategory,
      amount: data.amount,
      date: toISO(data.date),
      description: data.description?.trim() || undefined,
      status: data.status,
    };
    if (editing) {
      updateTransaction(editing.id, payload);
      toast.success("Transaction updated");
    } else {
      addTransaction(payload);
      toast.success("Transaction added");
    }
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card rounded-2xl shadow-xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-7 pt-6 pb-5">
            <h2 className="text-xl font-bold text-foreground">{editing ? "Edit transaction" : "Add transaction"}</h2>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          <div className="px-7 pb-6 space-y-4">
            {/* Type toggle */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Type</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
                <button onClick={() => setType("income")} className={cn("py-1.5 text-xs font-medium rounded-md transition-colors", type === "income" ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground hover:text-foreground")}>Income</button>
                <button onClick={() => setType("expense")} className={cn("py-1.5 text-xs font-medium rounded-md transition-colors", type === "expense" ? "bg-rose-500/15 text-rose-500" : "text-muted-foreground hover:text-foreground")}>Expense</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Challenge</label>
                <Select value={challengeId || "_none"} onValueChange={(v) => handleChallengeChange(v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="_none">None</SelectItem>
                    {challenges.map(c => <SelectItem key={c.challengeId} value={c.challengeId}>{c.nickname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Account</label>
                <Select value={accountId || "_none"} onValueChange={(v) => setAccountId(v === "_none" ? undefined : v)}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="_none">None</SelectItem>
                    {accountOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Firm</label>
                <Input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="e.g. FTMO" className="h-10 text-sm" maxLength={60} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Category</label>
                <Select value={category} onValueChange={(v) => setCategory(v as TxCategory)}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {categoryOptions.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Amount</label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-10 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Date</label>
                <AppDatePicker value={date} onChange={setDate} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Description (optional)</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder="Notes..." className="text-sm resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-muted/50 rounded-lg">
                {(["reviewed", "not_reviewed", "ignored"] as TxStatus[]).map(s => (
                  <button key={s} onClick={() => setStatus(s)} className={cn("py-1.5 text-xs font-medium rounded-md transition-colors capitalize", status === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-7 py-4 border-t border-border">
            <button onClick={onClose} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Cancel</button>
            <button onClick={handleSubmit} className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">{editing ? "Save changes" : "Add transaction"}</button>
          </div>
        </div>
      </div>
    </>
  );
}
