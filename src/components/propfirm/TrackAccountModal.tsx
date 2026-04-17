import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { X, Search, ChevronDown, ChevronUp, CalendarDays, Settings, ArrowRight, Check } from "lucide-react";
import { useStrategiesContext } from "@/contexts/StrategiesContext";
import { useAccountsContext } from "@/contexts/AccountsContext";
import { useChallengesContext, generateChallengeId, createDefaultStepRules, createDefaultFundedRules, type Challenge, type ChallengeRulesSchema, type StepRules as NewStepRules, type FundedRules as NewFundedRules } from "@/contexts/ChallengesContext";
import { toast } from "sonner";

type TrackAccountModalProps = { open: boolean; onClose: () => void; mode?: 'create' | 'edit' };
type Phase = "Evaluation" | "Funded";
type Steps = "1 Step" | "2 Steps";
type DrawdownType = "Static" | "EOD" | "Trailing";

// Internal form types (kept for UI compatibility)
export interface StepRules {
  minTradingDays: string;
  tradingPeriodEnd: string;
  tradingPeriodUnlimited: boolean;
  profitTarget: string;
  profitTargetUnit: "%" | "$";
  maxDailyLoss: string;
  maxDailyLossUnit: "%" | "$";
  maxDrawdown: string;
  maxDrawdownUnit: "%" | "$";
  maxDrawdownType: DrawdownType;
  bestDayConsistency: string;
}

export interface FundingRules {
  maxDailyLoss: string;
  maxDailyLossUnit: "%" | "$";
  minTradingDays: string;
  maxDrawdown: string;
  maxDrawdownUnit: "%" | "$";
  maxDrawdownType: DrawdownType;
  bestDayConsistency: string;
}

export interface ChallengeRules {
  balanceAmount: string;
  step1: StepRules;
  step2: StepRules;
  sameStep2AsStep1: boolean;
  funding: FundingRules;
  sameFundingAsStep1: boolean;
}

// ─── Form-to-Schema converters ───────────────────────────────────

function toUnitType(unit: "%" | "$"): "percent" | "amount" {
  return unit === "%" ? "percent" : "amount";
}

function toDrawdownType(dt: DrawdownType): "static" | "eod" | "trailing" {
  return dt.toLowerCase() as "static" | "eod" | "trailing";
}

function parseNum(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function convertStepRules(form: StepRules): NewStepRules {
  return {
    minTradingDays: parseNum(form.minTradingDays),
    tradingPeriodDays: form.tradingPeriodUnlimited ? null : parseNum(form.tradingPeriodEnd),
    isUnlimited: form.tradingPeriodUnlimited,
    profitTarget: { type: toUnitType(form.profitTargetUnit), value: parseNum(form.profitTarget) },
    maxDailyLoss: { type: toUnitType(form.maxDailyLossUnit), value: parseNum(form.maxDailyLoss) },
    maxDrawdown: { type: toDrawdownType(form.maxDrawdownType), mode: toUnitType(form.maxDrawdownUnit), value: parseNum(form.maxDrawdown) },
    consistency: parseNum(form.bestDayConsistency),
  };
}

function convertFundedRules(form: FundingRules, sameAsStep1: boolean): NewFundedRules {
  if (sameAsStep1) return { sameAsStep1: true };
  return {
    sameAsStep1: false,
    minTradingDays: parseNum(form.minTradingDays),
    maxDailyLoss: { type: toUnitType(form.maxDailyLossUnit), value: parseNum(form.maxDailyLoss) },
    maxDrawdown: { type: toDrawdownType(form.maxDrawdownType), mode: toUnitType(form.maxDrawdownUnit), value: parseNum(form.maxDrawdown) },
    consistency: parseNum(form.bestDayConsistency),
  };
}

const defaultStepRules = (): StepRules => ({
  minTradingDays: "", tradingPeriodEnd: "", tradingPeriodUnlimited: false,
  profitTarget: "", profitTargetUnit: "$", maxDailyLoss: "", maxDailyLossUnit: "$",
  maxDrawdown: "", maxDrawdownUnit: "$", maxDrawdownType: "Static", bestDayConsistency: "",
});

const defaultFundingRules = (): FundingRules => ({
  maxDailyLoss: "", maxDailyLossUnit: "$", minTradingDays: "",
  maxDrawdown: "", maxDrawdownUnit: "$", maxDrawdownType: "Static", bestDayConsistency: "",
});

// ─── Shared UI Components ────────────────────────────────────────

function UnitToggle({ value, onChange }: { value: "%" | "$"; onChange: (v: "%" | "$") => void }) {
  return (
    <div className="flex shrink-0">
      {(["%", "$"] as const).map((u) => (
        <button key={u} onClick={() => onChange(u)}
          className={`w-8 h-8 text-xs font-semibold border first:rounded-l-md last:rounded-r-md transition-colors ${value === u ? "bg-primary text-primary-foreground border-primary z-10" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}>{u}</button>
      ))}
    </div>
  );
}

function UnitInput({ unit, value, onChange, className }: { unit: "%" | "$"; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`flex items-center border border-border rounded-lg px-2.5 py-2 bg-background gap-1 ${className ?? ""}`}>
      {unit === "$" && <span className="text-xs text-muted-foreground shrink-0">$</span>}
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className="flex-1 text-sm focus:outline-none bg-transparent w-0 min-w-0" />
      {unit === "%" && <span className="text-xs text-muted-foreground shrink-0">%</span>}
    </div>
  );
}

function DrawdownToggle({ value, onChange }: { value: DrawdownType; onChange: (v: DrawdownType) => void }) {
  return (
    <div className="flex shrink-0">
      {(["Static", "EOD", "Trailing"] as const).map((t, i) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-2.5 h-8 text-xs font-semibold border transition-colors ${i === 0 ? "rounded-l-md" : i === 2 ? "rounded-r-md" : ""} ${value === t ? "bg-primary text-primary-foreground border-primary z-10" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}>{t}</button>
      ))}
    </div>
  );
}

function CheckboxItem({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer" onClick={onChange}>
      <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors shrink-0 ${checked ? "bg-primary border-primary" : "border-border bg-background"}`}>
        {checked && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

// ─── Step Section ────────────────────────────────────────────────

function StepSection({ title, disabled = false, rules, onChange }: { title: string; disabled?: boolean; rules: StepRules; onChange: (r: StepRules) => void }) {
  const [expanded, setExpanded] = useState(true);
  const upd = (patch: Partial<StepRules>) => onChange({ ...rules, ...patch });

  return (
    <div className={`border border-border rounded-xl overflow-hidden ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <span className="text-xs font-bold text-foreground tracking-wide">{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Minimum trading days</label><input type="text" value={rules.minTradingDays} onChange={e => upd({ minTradingDays: e.target.value })} placeholder="Type here" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none placeholder:text-muted-foreground/50" /></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Trading period end (days)</label><div className="flex items-center gap-2"><input type="text" value={rules.tradingPeriodEnd} onChange={e => upd({ tradingPeriodEnd: e.target.value })} placeholder="Type here" disabled={rules.tradingPeriodUnlimited} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none placeholder:text-muted-foreground/50 disabled:opacity-50" /><label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer" onClick={() => upd({ tradingPeriodUnlimited: !rules.tradingPeriodUnlimited })}><div className={`w-4 h-4 border rounded flex items-center justify-center ${rules.tradingPeriodUnlimited ? "bg-primary border-primary" : "border-border bg-background"}`}>{rules.tradingPeriodUnlimited && <Check className="w-3 h-3 text-primary-foreground" />}</div>Unlimited</label></div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Profit target</label><div className="flex items-center gap-1.5"><UnitToggle value={rules.profitTargetUnit} onChange={v => upd({ profitTargetUnit: v })} /><UnitInput unit={rules.profitTargetUnit} value={rules.profitTarget} onChange={v => upd({ profitTarget: v })} className="flex-1 min-w-0" /></div></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max daily loss</label><div className="flex items-center gap-1.5"><UnitToggle value={rules.maxDailyLossUnit} onChange={v => upd({ maxDailyLossUnit: v })} /><UnitInput unit={rules.maxDailyLossUnit} value={rules.maxDailyLoss} onChange={v => upd({ maxDailyLoss: v })} className="flex-1 min-w-0" /></div></div>
          </div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Drawdown</label><div className="flex items-center gap-1.5 flex-wrap"><DrawdownToggle value={rules.maxDrawdownType} onChange={v => upd({ maxDrawdownType: v })} /><UnitToggle value={rules.maxDrawdownUnit} onChange={v => upd({ maxDrawdownUnit: v })} /><UnitInput unit={rules.maxDrawdownUnit} value={rules.maxDrawdown} onChange={v => upd({ maxDrawdown: v })} className="flex-1 min-w-[60px]" /></div></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Best Day Consistency Target</label><div className="flex items-center border border-border rounded-lg px-3 py-2 bg-background gap-1"><input type="text" value={rules.bestDayConsistency} onChange={e => upd({ bestDayConsistency: e.target.value })} className="flex-1 text-sm focus:outline-none bg-transparent" /><span className="text-xs text-muted-foreground shrink-0">%</span></div><p className="text-[10px] text-muted-foreground/70 mt-1.5">E.g. Your best profitable day must be below 50% of your total profit.</p></div>
        </div>
      )}
    </div>
  );
}

// ─── Funding Section ─────────────────────────────────────────────

function FundingSectionUI({ defaultExpanded = false, rules, onChange }: { defaultExpanded?: boolean; rules: FundingRules; onChange: (r: FundingRules) => void }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const upd = (patch: Partial<FundingRules>) => onChange({ ...rules, ...patch });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <span className="text-xs font-bold text-foreground tracking-wide">FUNDING</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Daily Loss</label><div className="flex items-center gap-1.5"><UnitToggle value={rules.maxDailyLossUnit} onChange={v => upd({ maxDailyLossUnit: v })} /><UnitInput unit={rules.maxDailyLossUnit} value={rules.maxDailyLoss} onChange={v => upd({ maxDailyLoss: v })} className="flex-1 min-w-0" /></div></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Minimum trading days</label><input type="text" value={rules.minTradingDays} onChange={e => upd({ minTradingDays: e.target.value })} placeholder="Type here" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none placeholder:text-muted-foreground/50" /></div>
          </div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Drawdown</label><div className="flex items-center gap-1.5 flex-wrap"><DrawdownToggle value={rules.maxDrawdownType} onChange={v => upd({ maxDrawdownType: v })} /><UnitToggle value={rules.maxDrawdownUnit} onChange={v => upd({ maxDrawdownUnit: v })} /><UnitInput unit={rules.maxDrawdownUnit} value={rules.maxDrawdown} onChange={v => upd({ maxDrawdown: v })} className="flex-1 min-w-[60px]" /></div></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Best Day Consistency</label><div className="flex items-center border border-border rounded-lg px-3 py-2 bg-background gap-1"><input type="text" value={rules.bestDayConsistency} onChange={e => upd({ bestDayConsistency: e.target.value })} className="flex-1 text-sm focus:outline-none bg-transparent" /><span className="text-xs text-muted-foreground shrink-0">%</span></div><p className="text-[10px] text-muted-foreground/70 mt-1.5">E.g. Your best profitable day must be below 50% of your total profit.</p></div>
        </div>
      )}
    </div>
  );
}

// ─── Account Select Row ──────────────────────────────────────────

function AccountSelectRow({ label, showHelp = false }: { label: string; showHelp?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {showHelp && (<div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 flex items-center justify-center cursor-help"><span className="text-[9px] font-bold text-muted-foreground leading-none">?</span></div>)}
      </div>
      <div className="flex items-center gap-2.5 border border-primary/50 rounded-lg px-3 py-2.5 bg-background cursor-pointer hover:border-primary transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="hsl(var(--primary))" opacity="0.8" />
          <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="hsl(var(--primary))" opacity="0.8" />
          <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
          <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
        </svg>
        <span className="flex-1 text-sm text-foreground">Create a new account</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

// ─── Strategy Multi-Select ───────────────────────────────────────

function StrategyMultiSelect({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const { strategies } = useStrategiesContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id]);
  };

  const selectedNames = strategies.filter(s => selectedIds.includes(s.id)).map(s => s.name);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-foreground">Strategies (Setups)</label>
        <button onClick={() => navigate("/strategies")} className="text-xs font-medium text-primary hover:text-primary/80">Create new setup</button>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-background cursor-pointer text-left"
        >
          <span className={`text-sm truncate ${selectedNames.length ? "text-foreground" : "text-muted-foreground/60"}`}>
            {selectedNames.length ? selectedNames.join(", ") : "Select setups..."}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {strategies.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No setups created yet.{" "}
                  <button onClick={() => navigate("/strategies")} className="text-primary hover:underline">Create one</button>
                </div>
              ) : strategies.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center shrink-0 ${selectedIds.includes(s.id) ? "bg-primary border-primary" : "border-border bg-background"}`}>
                    {selectedIds.includes(s.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm text-foreground">{s.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Edit Rules Panel ────────────────────────────────────────────

function EditRulesPanel({ onDone, phase, steps, rules, onRulesChange }: {
  onDone: () => void; phase: Phase; steps: Steps;
  rules: ChallengeRules; onRulesChange: (r: ChallengeRules) => void;
}) {
  const isFunded = phase === "Funded";
  const show2Steps = phase === "Evaluation" && steps === "2 Steps";
  const sizes = ["25K", "50K", "75K", "100K", "150K", "200K"];

  const setBalance = (v: string) => onRulesChange({ ...rules, balanceAmount: v });
  const selectSize = (s: string) => {
    const val = s.replace("K", "000");
    onRulesChange({ ...rules, balanceAmount: rules.balanceAmount === val ? "" : val });
  };
  const selectedSize = useMemo(() => sizes.find(s => s.replace("K", "000") === rules.balanceAmount) ?? null, [rules.balanceAmount]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-border shrink-0">
        <h2 className="text-lg font-bold text-foreground">Edit rules</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Balance amount <span className="text-rose-500">*</span></label>
          <div className="flex items-center border border-border rounded-lg px-3 py-2.5 bg-background gap-1.5 mb-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input type="text" value={rules.balanceAmount} onChange={e => setBalance(e.target.value)} className="flex-1 text-sm focus:outline-none bg-transparent" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {sizes.map(s => (
              <button key={s} onClick={() => selectSize(s)}
                className={`px-3.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${selectedSize === s ? "bg-primary/10 border-primary text-primary" : "border-border bg-background text-foreground hover:border-foreground/30"}`}>{s}</button>
            ))}
          </div>
        </div>
        {!isFunded && (
          <>
            <StepSection title="STEP 1" rules={rules.step1} onChange={s1 => onRulesChange({ ...rules, step1: s1 })} />
            {show2Steps && (
              <>
                <CheckboxItem checked={rules.sameStep2AsStep1} onChange={() => onRulesChange({ ...rules, sameStep2AsStep1: !rules.sameStep2AsStep1 })} label="Same rules as Step 1" />
                <StepSection title="STEP 2" disabled={rules.sameStep2AsStep1} rules={rules.step2} onChange={s2 => onRulesChange({ ...rules, step2: s2 })} />
              </>
            )}
            <CheckboxItem checked={rules.sameFundingAsStep1} onChange={() => onRulesChange({ ...rules, sameFundingAsStep1: !rules.sameFundingAsStep1 })} label="Same rules as Step 1" />
            <FundingSectionUI defaultExpanded={false} rules={rules.funding} onChange={f => onRulesChange({ ...rules, funding: f })} />
          </>
        )}
        {isFunded && <FundingSectionUI defaultExpanded={true} rules={rules.funding} onChange={f => onRulesChange({ ...rules, funding: f })} />}
      </div>
      <div className="px-7 py-4 border-t border-border shrink-0 flex justify-end">
        <button onClick={onDone} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Done <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────

export function TrackAccountModal({ open, onClose, mode = 'create' }: TrackAccountModalProps) {
  const isEdit = mode === 'edit';
  const { user } = useAuth();
  const { addAccount } = useAccountsContext();
  const { addChallenge } = useChallengesContext();
  const [nickname, setNickname] = useState("");
  const [fundingFirm, setFundingFirm] = useState("");
  const [strategyIds, setStrategyIds] = useState<string[]>([]);
  const [evaluationFee, setEvaluationFee] = useState("0");
  const [activationFee, setActivationFee] = useState("0");
  const [phase, setPhase] = useState<Phase>("Evaluation");
  const [status, setStatus] = useState<"Active" | "Breached">("Active");
  const [steps, setSteps] = useState<Steps>("1 Step");
  const [accountSetup, setAccountSetup] = useState<"Automatic accounts" | "Customize accounts">("Automatic accounts");
  const [startDate, setStartDate] = useState("");
  const [showEditRules, setShowEditRules] = useState(false);
  const [rules, setRules] = useState<ChallengeRules>({
    balanceAmount: "", step1: defaultStepRules(), step2: defaultStepRules(),
    sameStep2AsStep1: false, funding: defaultFundingRules(), sameFundingAsStep1: false,
  });

  const isFunded = phase === "Funded";

  const handleCreate = () => {
    if (!nickname.trim()) { toast.error("Challenge nickname is required"); return; }
    if (!fundingFirm.trim()) { toast.error("Funding firm is required"); return; }
    if (!startDate) { toast.error("Start date is required"); return; }

    const challengeId = generateChallengeId();
    const balanceAmount = parseFloat(rules.balanceAmount) || 0;

    // Build structured rules
    const show2Steps = !isFunded && steps === "2 Steps";
    const structuredRules: ChallengeRulesSchema = {
      step1: isFunded ? createDefaultStepRules() : convertStepRules(rules.step1),
      step2: show2Steps
        ? (rules.sameStep2AsStep1 ? convertStepRules(rules.step1) : convertStepRules(rules.step2))
        : null,
      funded: isFunded
        ? convertFundedRules(rules.funding, false)
        : convertFundedRules(rules.funding, rules.sameFundingAsStep1),
    };

    const stepsValue = isFunded ? 0 as const : (steps === '2 Steps' ? 2 as const : 1 as const);


    const challenge: Challenge = {
      challengeId,
      userId: user?.userId || '',
      nickname: nickname.trim(),
      firm: fundingFirm.trim(),
      balanceAmount,
      steps: stepsValue,
      status: status.toLowerCase() as 'active' | 'breached',
      setups: strategyIds,
      startDate,
      evaluationFee: parseFloat(evaluationFee) || 0,
      activationFee: parseFloat(activationFee) || 0,
      rules: structuredRules,
      createdAt: new Date().toISOString(),
    };

    addChallenge(challenge);

    // Create a propfirm account based on phase
    if (isFunded) {
      addAccount(
        `${challenge.nickname} (Funded)`,
        balanceAmount,
        'propfirm',
        {
          challengeId,
          step: 'funded' as const,
          phase: 'funded' as const,
          status: status.toLowerCase() as 'active' | 'breached',
        }
      );
    } else {
      addAccount(
        `${challenge.nickname} (Step 1)`,
        balanceAmount,
        'propfirm',
        {
          challengeId,
          step: '1' as const,
          phase: 'evaluation' as const,
          status: status.toLowerCase() as 'active' | 'breached',
        }
      );
    }

    toast.success(`Challenge "${challenge.nickname}" created (ID: ${challengeId})`);
    // Reset
    setNickname(""); setFundingFirm(""); setStrategyIds([]); setEvaluationFee("0");
    setActivationFee("0"); setPhase("Evaluation"); setStatus("Active"); setSteps("1 Step");
    setAccountSetup("Automatic accounts"); setStartDate(""); setShowEditRules(false);
    setRules({ balanceAmount: "", step1: defaultStepRules(), step2: defaultStepRules(), sameStep2AsStep1: false, funding: defaultFundingRules(), sameFundingAsStep1: false });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-background rounded-2xl shadow-xl w-full max-w-[680px] h-[90vh] overflow-hidden pointer-events-auto flex flex-col relative" onClick={e => e.stopPropagation()}>
          <div className="flex flex-1 min-h-0 transition-transform duration-300 ease-in-out" style={{ width: "200%", transform: showEditRules ? "translateX(-50%)" : "translateX(0)" }}>
            {/* Step 1: Main form */}
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-border shrink-0">
                <h2 className="text-lg font-bold text-foreground">Add Challenge</h2>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
                {/* Nickname + Edit Rules */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Challenge nickname <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. FTMO 100K Step 1" className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-background placeholder:text-muted-foreground/50" />
                    <button onClick={() => setShowEditRules(true)} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-border rounded-lg bg-background text-foreground hover:bg-muted/30 transition-colors whitespace-nowrap"><Settings className="w-3.5 h-3.5 text-muted-foreground" />Edit rules</button>
                  </div>
                </div>
                {/* Funding firm */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Funding firm <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2.5 bg-background"><Search className="w-4 h-4 text-muted-foreground shrink-0" /><input type="text" value={fundingFirm} onChange={e => setFundingFirm(e.target.value)} placeholder="Search firms..." className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-muted-foreground/60" /></div>
                </div>
                {/* Strategies */}
                <StrategyMultiSelect selectedIds={strategyIds} onChange={setStrategyIds} />
                {/* Fees */}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Evaluation Fee <span className="text-rose-500">*</span></label><div className="flex items-center border border-border rounded-lg px-3 py-2.5 bg-background gap-1.5"><span className="text-sm text-muted-foreground">$</span><input type="text" value={evaluationFee} onChange={e => setEvaluationFee(e.target.value)} className="flex-1 text-sm focus:outline-none bg-transparent" /></div></div>
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Activation Fee <span className="text-rose-500">*</span></label><div className="flex items-center border border-border rounded-lg px-3 py-2.5 bg-background gap-1.5"><span className="text-sm text-muted-foreground">$</span><input type="text" value={activationFee} onChange={e => setActivationFee(e.target.value)} className="flex-1 text-sm focus:outline-none bg-transparent" /></div></div>
                </div>
                {/* Phase / Status / Steps */}
                <div className={`grid gap-4 ${isFunded ? "grid-cols-2" : "grid-cols-3"}`}>
                  <div><label className="block text-xs font-medium text-foreground mb-2">Account Phase</label><div className="flex gap-1.5">{(["Evaluation", "Funded"] as Phase[]).map(opt => (<button key={opt} onClick={() => setPhase(opt)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${phase === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-background"}`}>{opt}</button>))}</div></div>
                  <div><label className="block text-xs font-medium text-foreground mb-2">Account Status</label><div className="flex gap-1.5 flex-wrap">{(["Active", "Breached"] as const).map(opt => (<button key={opt} onClick={() => setStatus(opt)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${status === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-background"}`}>{opt}</button>))}</div></div>
                  {!isFunded && (<div><label className="block text-xs font-medium text-foreground mb-2">Number of Steps</label><div className="flex gap-1.5 flex-wrap">{(["1 Step", "2 Steps"] as Steps[]).map(opt => (<button key={opt} onClick={() => setSteps(opt)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${steps === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-background"}`}>{opt}</button>))}</div></div>)}
                </div>
                {/* Account Setup */}
                <div><label className="block text-sm font-medium text-foreground mb-2">Account Setup</label><div className="flex gap-2">{(["Automatic accounts", "Customize accounts"] as const).map(opt => (<button key={opt} onClick={() => setAccountSetup(opt)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${accountSetup === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-background"}`}>{opt}</button>))}</div></div>
                {accountSetup === "Automatic accounts" ? (
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"><div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div><p className="text-sm font-semibold text-emerald-700">Accounts will be created automatically</p><p className="text-xs text-emerald-600/80 mt-0.5">A new account will be generated for each step as it begins.</p></div></div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">{!isFunded && (<><AccountSelectRow label="Step 1 – select account" />{steps === "2 Steps" && <AccountSelectRow label="Step 2 – select account" />}</>)}<AccountSelectRow label="Funding – select account" showHelp /></div>
                )}
                {/* Broker (disabled) */}
                <div><label className="block text-sm font-medium text-foreground mb-1.5">Broker</label><div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-muted/30 opacity-60 cursor-not-allowed"><span className="text-sm text-muted-foreground">Coming soon</span><Search className="w-4 h-4 text-muted-foreground shrink-0" /></div></div>
                {/* Start date + Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Start date <span className="text-rose-500">*</span></label><div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-background"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 text-sm focus:outline-none bg-transparent text-foreground" /><CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" /></div></div>
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label><input type="number" value={1} disabled className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-muted/30 opacity-60 cursor-not-allowed" /></div>
                </div>
              </div>
              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-border shrink-0">
                <button onClick={onClose} className="px-5 py-2 text-sm font-medium border border-border rounded-lg text-foreground bg-background hover:bg-muted/30 transition-colors">Cancel</button>
                <button onClick={handleCreate} className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Create challenge</button>
              </div>
            </div>
            {/* Step 2: Edit Rules */}
            <div className="w-1/2 flex flex-col min-h-0">
              <EditRulesPanel onDone={() => setShowEditRules(false)} phase={phase} steps={steps} rules={rules} onRulesChange={setRules} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
