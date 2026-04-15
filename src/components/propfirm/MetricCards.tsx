import { TrendingUp, TrendingDown, DollarSign, CircleDot } from "lucide-react";

export function MetricCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <CircleDot className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-muted-foreground font-medium">Funded</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">$50,000</div>
            <div className="text-xs text-muted-foreground mt-1">1 funded account</div>
          </div>
          <div className="border-l border-border pl-3">
            <div className="flex items-center gap-1 mb-1">
              <CircleDot className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">Evaluation</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">$10,000</div>
            <div className="text-xs text-muted-foreground mt-1">1 eval account</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <div className="text-xs text-muted-foreground font-medium mb-3">Total spent</div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground tracking-tight">$167</div>
            <div className="text-xs text-muted-foreground mt-0.5">Evaluation fees &amp; resets</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <div className="text-xs text-muted-foreground font-medium mb-3">Total earned</div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground tracking-tight">$500</div>
            <div className="text-xs text-muted-foreground mt-0.5">Payouts received</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <div className="text-xs text-muted-foreground font-medium mb-3">Net total</div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">+$333</div>
            <div className="text-xs text-emerald-600/80 font-medium mt-0.5">+199.4% ROI</div>
          </div>
        </div>
      </div>
    </div>
  );
}
