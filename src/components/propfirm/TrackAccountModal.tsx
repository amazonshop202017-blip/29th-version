import { useState } from "react";
import { X, Search, ChevronDown, ChevronUp, CalendarDays, Settings, ArrowRight, Check } from "lucide-react";

type TrackAccountModalProps = { open: boolean; onClose: () => void };
type Phase = "Evaluation" | "Funded";
type Steps = "1 Step" | "2 Steps";

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

function UnitInput({ unit, className }: { unit: "%" | "$"; className?: string }) {
  return (
    <div className={`flex items-center border border-border rounded-lg px-2.5 py-2 bg-white gap-1 ${className ?? ""}`}>
      {unit === "$" && <span className="text-xs text-muted-foreground shrink-0">$</span>}
      <input type="text" readOnly className="flex-1 text-sm focus:outline-none bg-transparent w-0 min-w-0" />
      {unit === "%" && <span className="text-xs text-muted-foreground shrink-0">%</span>}
    </div>
  );
}

function DrawdownToggle({ value, onChange }: { value: "Static" | "EOD" | "Trailing"; onChange: (v: "Static" | "EOD" | "Trailing") => void }) {
  return (
    <div className="flex shrink-0">
      {(["Static", "EOD", "Trailing"] as const).map((t, i) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-2.5 h-8 text-xs font-semibold border transition-colors ${i === 0 ? "rounded-l-md" : i === 2 ? "rounded-r-md" : ""} ${value === t ? "bg-primary text-primary-foreground border-primary z-10" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}>{t}</button>
      ))}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer" onClick={onChange}>
      <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors shrink-0 ${checked ? "bg-primary border-primary" : "border-border bg-white"}`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

function StepSection({ title, disabled = false }: { title: string; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [ptUnit, setPtUnit] = useState<"%" | "$">("$");
  const [mdlUnit, setMdlUnit] = useState<"%" | "$">("$");
  const [ddType, setDdType] = useState<"Static" | "EOD" | "Trailing">("Static");
  const [ddUnit, setDdUnit] = useState<"%" | "$">("$");
  const [unlimited, setUnlimited] = useState(false);

  return (
    <div className={`border border-border rounded-xl overflow-hidden ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <span className="text-xs font-bold text-foreground tracking-wide">{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Minimum trading days</label><input type="text" placeholder="Type here" readOnly className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none placeholder:text-muted-foreground/50" /></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Trading period end (days)</label><div className="flex items-center gap-2"><input type="text" placeholder="Type here" readOnly className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none placeholder:text-muted-foreground/50" /><label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer" onClick={() => setUnlimited(v => !v)}><div className={`w-4 h-4 border rounded flex items-center justify-center ${unlimited ? "bg-primary border-primary" : "border-border bg-white"}`}>{unlimited && <Check className="w-3 h-3 text-white" />}</div>Unlimited</label></div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Profit target</label><div className="flex items-center gap-1.5"><UnitToggle value={ptUnit} onChange={setPtUnit} /><UnitInput unit={ptUnit} className="flex-1 min-w-0" /></div></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max daily loss</label><div className="flex items-center gap-1.5"><UnitToggle value={mdlUnit} onChange={setMdlUnit} /><UnitInput unit={mdlUnit} className="flex-1 min-w-0" /></div></div>
          </div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Drawdown</label><div className="flex items-center gap-1.5 flex-wrap"><DrawdownToggle value={ddType} onChange={setDdType} /><UnitToggle value={ddUnit} onChange={setDdUnit} /><UnitInput unit={ddUnit} className="flex-1 min-w-[60px]" /></div></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Best Day Consistency Target</label><div className="flex items-center border border-border rounded-lg px-3 py-2 bg-white gap-1"><input type="text" readOnly className="flex-1 text-sm focus:outline-none bg-transparent" /><span className="text-xs text-muted-foreground shrink-0">%</span></div><p className="text-[10px] text-muted-foreground/70 mt-1.5">E.g. Your best profitable day must be below 50% of your total profit.</p></div>
        </div>
      )}
    </div>
  );
}

function FundingSection({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [mdlUnit, setMdlUnit] = useState<"%" | "$">("$");
  const [ddType, setDdType] = useState<"Static" | "EOD" | "Trailing">("Static");
  const [ddUnit, setDdUnit] = useState<"%" | "$">("$");

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <span className="text-xs font-bold text-foreground tracking-wide">FUNDING</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Daily Loss</label><div className="flex items-center gap-1.5"><UnitToggle value={mdlUnit} onChange={setMdlUnit} /><UnitInput unit={mdlUnit} className="flex-1 min-w-0" /></div></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Minimum trading days</label><input type="text" placeholder="Type here" readOnly className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none placeholder:text-muted-foreground/50" /></div>
          </div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Drawdown</label><div className="flex items-center gap-1.5 flex-wrap"><DrawdownToggle value={ddType} onChange={setDdType} /><UnitToggle value={ddUnit} onChange={setDdUnit} /><UnitInput unit={ddUnit} className="flex-1 min-w-[60px]" /></div></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Best Day Consistency</label><div className="flex items-center border border-border rounded-lg px-3 py-2 bg-white gap-1"><input type="text" readOnly className="flex-1 text-sm focus:outline-none bg-transparent" /><span className="text-xs text-muted-foreground shrink-0">%</span></div><p className="text-[10px] text-muted-foreground/70 mt-1.5">E.g. Your best profitable day must be below 50% of your total profit.</p></div>
        </div>
      )}
    </div>
  );
}

function AccountSelectRow({ label, showHelp = false }: { label: string; showHelp?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {showHelp && (<div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 flex items-center justify-center cursor-help"><span className="text-[9px] font-bold text-muted-foreground leading-none">?</span></div>)}
      </div>
      <div className="flex items-center gap-2.5 border border-primary/50 rounded-lg px-3 py-2.5 bg-white cursor-pointer hover:border-primary transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="#818cf8" opacity="0.8" />
          <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" fill="#818cf8" opacity="0.8" />
          <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" fill="#818cf8" opacity="0.5" />
          <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill="#818cf8" opacity="0.5" />
        </svg>
        <span className="flex-1 text-sm text-foreground">Create a new account</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

function EditRulesPanel({ onDone, phase, steps }: { onDone: () => void; phase: Phase; steps: Steps }) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sameStep2AsStep1, setSameStep2AsStep1] = useState(false);
  const [sameFundingAsStep1, setSameFundingAsStep1] = useState(false);
  const isFunded = phase === "Funded";
  const show2Steps = phase === "Evaluation" && steps === "2 Steps";
  const sizes = ["25K", "50K", "75K", "100K", "150K", "200K"];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-border shrink-0">
        <h2 className="text-lg font-bold text-foreground">Edit rules</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Balance amount <span className="text-rose-500">*</span></label>
          <div className="flex items-center border border-border rounded-lg px-3 py-2.5 bg-white gap-1.5 mb-2"><span className="text-sm text-muted-foreground">$</span><input type="text" defaultValue="0" readOnly className="flex-1 text-sm focus:outline-none bg-transparent" /></div>
          <div className="flex gap-2 flex-wrap">{sizes.map(s => (<button key={s} onClick={() => setSelectedSize(s === selectedSize ? null : s)} className={`px-3.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${selectedSize === s ? "bg-primary/10 border-primary text-primary" : "border-border bg-white text-foreground hover:border-foreground/30"}`}>{s}</button>))}</div>
        </div>
        {!isFunded && (
          <>
            <StepSection title="STEP 1" />
            {show2Steps && (<><Checkbox checked={sameStep2AsStep1} onChange={() => setSameStep2AsStep1(v => !v)} label="Same rules as Step 1" /><StepSection title="STEP 2" disabled={sameStep2AsStep1} /></>)}
            <Checkbox checked={sameFundingAsStep1} onChange={() => setSameFundingAsStep1(v => !v)} label="Same rules as Step 1" />
            <FundingSection defaultExpanded={false} />
          </>
        )}
        {isFunded && <FundingSection defaultExpanded={true} />}
      </div>
      <div className="px-7 py-4 border-t border-border shrink-0 flex justify-end">
        <button onClick={onDone} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Done <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function TrackAccountModal({ open, onClose }: TrackAccountModalProps) {
  const [phase, setPhase] = useState<Phase>("Evaluation");
  const [status, setStatus] = useState<"Active" | "Breached">("Active");
  const [steps, setSteps] = useState<Steps>("1 Step");
  const [setup, setSetup] = useState<"Automatic accounts" | "Customize accounts">("Automatic accounts");
  const [showEditRules, setShowEditRules] = useState(false);
  const isFunded = phase === "Funded";

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-[680px] h-[90vh] overflow-hidden pointer-events-auto flex flex-col relative" onClick={e => e.stopPropagation()}>
          <div className="flex flex-1 min-h-0 transition-transform duration-300 ease-in-out" style={{ width: "200%", transform: showEditRules ? "translateX(-50%)" : "translateX(0)" }}>
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-border shrink-0">
                <h2 className="text-lg font-bold text-foreground">Track prop firm account</h2>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Challenge nickname <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <input type="text" readOnly className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-white" />
                    <button onClick={() => setShowEditRules(true)} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-border rounded-lg bg-white text-foreground hover:bg-muted/30 transition-colors whitespace-nowrap"><Settings className="w-3.5 h-3.5 text-muted-foreground" />Edit rules</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Funding firm <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2.5 bg-white"><Search className="w-4 h-4 text-muted-foreground shrink-0" /><input type="text" placeholder="Search firms..." readOnly className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-muted-foreground/60" /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5"><label className="text-sm font-medium text-foreground">Strategies</label><button className="text-xs font-medium text-primary hover:text-primary/80">Create new strategy</button></div>
                  <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-white cursor-pointer"><span className="text-sm text-muted-foreground/60">Select strategies...</span><ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Evaluation Fee <span className="text-rose-500">*</span></label><div className="flex items-center border border-border rounded-lg px-3 py-2.5 bg-white gap-1.5"><span className="text-sm text-muted-foreground">$</span><input type="text" defaultValue="0" readOnly className="flex-1 text-sm focus:outline-none bg-transparent" /></div></div>
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Activation Fee <span className="text-rose-500">*</span></label><div className="flex items-center border border-border rounded-lg px-3 py-2.5 bg-white gap-1.5"><span className="text-sm text-muted-foreground">$</span><input type="text" defaultValue="0" readOnly className="flex-1 text-sm focus:outline-none bg-transparent" /></div></div>
                </div>
                <div className={`grid gap-4 ${isFunded ? "grid-cols-2" : "grid-cols-3"}`}>
                  <div><label className="block text-xs font-medium text-foreground mb-2">Account Phase</label><div className="flex gap-1.5">{(["Evaluation", "Funded"] as Phase[]).map(opt => (<button key={opt} onClick={() => setPhase(opt)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${phase === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-white"}`}>{opt}</button>))}</div></div>
                  <div><label className="block text-xs font-medium text-foreground mb-2">Account Status</label><div className="flex gap-1.5 flex-wrap">{(["Active", "Breached"] as const).map(opt => (<button key={opt} onClick={() => setStatus(opt)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${status === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-white"}`}>{opt}</button>))}</div></div>
                  {!isFunded && (<div><label className="block text-xs font-medium text-foreground mb-2">Number of Steps</label><div className="flex gap-1.5 flex-wrap">{(["1 Step", "2 Steps"] as Steps[]).map(opt => (<button key={opt} onClick={() => setSteps(opt)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${steps === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-white"}`}>{opt}</button>))}</div></div>)}
                </div>
                <div><label className="block text-sm font-medium text-foreground mb-2">Account Setup</label><div className="flex gap-2">{(["Automatic accounts", "Customize accounts"] as const).map(opt => (<button key={opt} onClick={() => setSetup(opt)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${setup === opt ? "bg-primary/10 border-primary text-primary" : "border-border text-foreground hover:border-foreground/40 bg-white"}`}>{opt}</button>))}</div></div>
                {setup === "Automatic accounts" ? (
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"><div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5"><svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div><p className="text-sm font-semibold text-emerald-700">Accounts will be created automatically</p><p className="text-xs text-emerald-600/80 mt-0.5">A new account will be generated for each step as it begins.</p></div></div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">{!isFunded && (<><AccountSelectRow label="Step 1 – select account" />{steps === "2 Steps" && <AccountSelectRow label="Step 2 – select account" />}</>)}<AccountSelectRow label="Funding – select account" showHelp /></div>
                )}
                <div><label className="block text-sm font-medium text-foreground mb-1.5">Broker</label><div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-white"><input type="text" placeholder="Start typing the broker" readOnly className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-muted-foreground/60" /><Search className="w-4 h-4 text-muted-foreground shrink-0" /></div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Start date <span className="text-rose-500">*</span></label><div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5 bg-white"><span className="text-sm text-muted-foreground/60">MM/DD/YYYY</span><CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" /></div></div>
                  <div><label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label><input type="number" defaultValue={1} readOnly className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none bg-white" /></div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-border shrink-0">
                <button onClick={onClose} className="px-5 py-2 text-sm font-medium border border-border rounded-lg text-foreground bg-white hover:bg-muted/30 transition-colors">Cancel</button>
                <button className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Create challenge</button>
              </div>
            </div>
            <div className="w-1/2 flex flex-col min-h-0">
              <EditRulesPanel onDone={() => setShowEditRules(false)} phase={phase} steps={steps} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
