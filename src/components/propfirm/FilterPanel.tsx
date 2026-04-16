import { useState } from "react";
import { X, ChevronDown } from "lucide-react";

function PillToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${active ? "border-foreground bg-foreground text-background dark:bg-foreground dark:text-background" : "border-border bg-card text-foreground hover:border-foreground/40"}`}>
      {label}
    </button>
  );
}

function SearchDropdown({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex items-center justify-between w-full border border-border rounded-lg px-3 py-2.5 bg-card cursor-pointer hover:border-foreground/30 transition-colors">
      <span className="text-sm text-muted-foreground">{placeholder}</span>
      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
    </div>
  );
}

type FilterPanelProps = { open: boolean; onClose: () => void };

export function FilterPanel({ open, onClose }: FilterPanelProps) {
  const [phase, setPhase] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [size, setSize] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);

  function toggle(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-50 w-[460px] bg-card rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Filters</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div><label className="block text-sm font-medium text-foreground mb-2">Firm</label><SearchDropdown placeholder="Search firms..." /></div>
          <div><label className="block text-sm font-medium text-foreground mb-3">Phase</label><div className="flex flex-wrap gap-2">{["Evaluation", "Funded"].map((v) => (<PillToggle key={v} label={v} active={phase.includes(v)} onClick={() => toggle(phase, setPhase, v)} />))}</div></div>
          <div><label className="block text-sm font-medium text-foreground mb-3">Status</label><div className="flex flex-wrap gap-2">{["Active", "Breached"].map((v) => (<PillToggle key={v} label={v} active={status.includes(v)} onClick={() => toggle(status, setStatus, v)} />))}</div></div>
          <div><label className="block text-sm font-medium text-foreground mb-3">Account Size</label><div className="flex flex-wrap gap-2">{["$10K", "$50K"].map((v) => (<PillToggle key={v} label={v} active={size.includes(v)} onClick={() => toggle(size, setSize, v)} />))}</div></div>
          <div><label className="block text-sm font-medium text-foreground mb-3">Account Type</label><div className="flex flex-wrap gap-2">{["1-step", "2-step", "Straight to Funded (S2F)"].map((v) => (<PillToggle key={v} label={v} active={type.includes(v)} onClick={() => toggle(type, setType, v)} />))}</div></div>
          <div><label className="block text-sm font-medium text-foreground mb-2">Strategy</label><SearchDropdown placeholder="Search strategies..." /></div>
        </div>
      </div>
    </>
  );
}
