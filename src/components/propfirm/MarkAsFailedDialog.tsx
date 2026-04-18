import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { toast } from "sonner";

const REASONS = [
  { value: "max_drawdown", label: "Broke max drawdown" },
  { value: "overtrading", label: "Overtrading / Forcing trades" },
  { value: "time_pressure", label: "Time pressure" },
  { value: "risk_management", label: "Lack of risk management" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName?: string;
  accountSubtitle?: string;
  onConfirm?: (reason: string) => void;
};

export function MarkAsFailedDialog({ open, onOpenChange, accountName = "e8", accountSubtitle = 'Use "e8 markets"', onConfirm }: Props) {
  const [reason, setReason] = useState<string>("max_drawdown");
  const [customReason, setCustomReason] = useState<string>("");

  useEffect(() => {
    if (open) {
      setReason("max_drawdown");
      setCustomReason("");
    }
  }, [open]);

  const handleConfirm = () => {
    // Pass raw enum value (e.g. "max_drawdown") OR raw custom string when "Other" is selected.
    // Display-layer formatting lives in src/lib/breachReason.ts
    const finalReason = reason === "other" ? (customReason.trim() || "Other") : reason;
    onConfirm?.(finalReason);
    toast.success(`${accountName} marked as failed`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-6 gap-0">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-base font-semibold">Mark Evaluation Account as failed?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            This will mark this Evaluation Account as failed and lock the current phase.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
          <div className="text-sm font-semibold text-foreground">Account: {accountName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{accountSubtitle}</div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-foreground mb-3">Why did this Evaluation Account fail?</p>
          <RadioGroup value={reason} onValueChange={setReason} className="gap-2.5">
            {REASONS.map((r) => (
              <label key={r.value} htmlFor={r.value} className="flex items-center gap-2.5 cursor-pointer">
                <RadioGroupItem id={r.value} value={r.value} />
                <span className="text-sm text-foreground">{r.label}</span>
              </label>
            ))}
            <div className="flex items-center gap-2.5">
              <RadioGroupItem id="other" value="other" />
              <label htmlFor="other" className="text-sm text-foreground cursor-pointer shrink-0">Other:</label>
              <Input
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  if (e.target.value) setReason("other");
                }}
                placeholder="Enter custom reason"
                className="h-8 text-sm flex-1"
              />
            </div>
          </RadioGroup>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-primary/90 leading-relaxed">
            This reason will be used in your analytics and insights to help you improve your passing rate.
          </p>
        </div>

        <DialogFooter className="mt-5 sm:justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} className="bg-primary hover:bg-primary/90">Mark as failed</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MarkAsFailedDialog;
