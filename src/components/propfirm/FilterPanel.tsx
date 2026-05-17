import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronDown, Check, Search } from "lucide-react";
import { useChallengesContext } from "@/contexts/ChallengesContext";
import { useStrategiesContext } from "@/contexts/StrategiesContext";
import {
  EMPTY_PROPFIRM_FILTERS,
  PropFirmFilters,
  PropFirmFilterPhase,
  PropFirmFilterStatus,
  PropFirmFilterStep,
  usePropFirmFilters,
} from "@/contexts/PropFirmFiltersContext";
import { formatSizeBucket } from "@/lib/propfirmDashboardStats";

function PillToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40"
      }`}
    >
      {label}
    </button>
  );
}

function MultiSelectDropdown({
  placeholder,
  options,
  selected,
  onToggle,
  formatLabel,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  formatLabel?: (count: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = useMemo(
    () => options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  const display = selected.length
    ? (formatLabel ? formatLabel(selected.length) : `${selected.length} selected`)
    : placeholder;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full border border-border rounded-lg px-3 py-2.5 bg-card hover:border-foreground/30 transition-colors"
      >
        <span className={`text-sm ${selected.length ? "text-foreground" : "text-muted-foreground"}`}>{display}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="relative border-b border-border">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">No results</div>
            ) : (
              filtered.map(opt => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                  >
                    <span className="text-foreground">{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type FilterPanelProps = { open: boolean; onClose: () => void };

const PHASE_OPTIONS: { value: PropFirmFilterPhase; label: string }[] = [
  { value: "evaluation", label: "Evaluation" },
  { value: "funded", label: "Funded" },
];
const STATUS_OPTIONS: { value: PropFirmFilterStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "breached", label: "Breached" },
  { value: "funded", label: "Funded" },
];
const STEP_OPTIONS: { value: PropFirmFilterStep; label: string }[] = [
  { value: 1, label: "1-step" },
  { value: 2, label: "2-step" },
  { value: 0, label: "Straight to Funded (S2F)" },
];

export function FilterPanel({ open, onClose }: FilterPanelProps) {
  const { challenges } = useChallengesContext();
  const { strategies } = useStrategiesContext();
  const { applied, setApplied } = usePropFirmFilters();

  const [draft, setDraft] = useState<PropFirmFilters>(applied);

  // When popup opens, seed draft from current applied filters
  useEffect(() => {
    if (open) setDraft(applied);
  }, [open, applied]);

  const firmOptions = useMemo(() => {
    const set = new Set<string>();
    challenges.forEach(c => c.firm && set.add(c.firm));
    return Array.from(set).sort().map(f => ({ value: f, label: f }));
  }, [challenges]);

  const sizeOptions = useMemo(() => {
    const set = new Set<number>();
    challenges.forEach(c => c.balanceAmount && set.add(c.balanceAmount));
    return Array.from(set).sort((a, b) => a - b).map(s => ({ value: String(s), label: formatSizeBucket(s) }));
  }, [challenges]);

  const strategyOptions = useMemo(() => {
    // Combine strategies from StrategiesContext + any setup names found in challenges
    const set = new Set<string>();
    strategies.forEach(s => set.add(s.name));
    challenges.forEach(c => c.setups?.forEach(s => set.add(s)));
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [strategies, challenges]);

  if (!open) return null;

  const toggleArray = <T extends string | number>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const handleApply = () => {
    setApplied(draft);
    onClose();
  };
  const handleCancel = () => {
    onClose();
  };
  const handleReset = () => {
    setDraft(EMPTY_PROPFIRM_FILTERS);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={handleCancel} />
      <div className="fixed left-3 right-3 top-20 z-50 w-auto sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[460px] sm:max-w-[calc(100vw-2rem)] bg-card rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Filters</h2>
          <button onClick={handleCancel} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Firm</label>
            <MultiSelectDropdown
              placeholder="Search firms..."
              options={firmOptions}
              selected={draft.firms}
              onToggle={v => setDraft(d => ({ ...d, firms: toggleArray(d.firms, v) }))}
              formatLabel={n => `${n} firm${n === 1 ? "" : "s"} selected`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Phase</label>
            <div className="flex flex-wrap gap-2">
              {PHASE_OPTIONS.map(opt => (
                <PillToggle
                  key={opt.value}
                  label={opt.label}
                  active={draft.phases.includes(opt.value)}
                  onClick={() => setDraft(d => ({ ...d, phases: toggleArray(d.phases, opt.value) }))}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <PillToggle
                  key={opt.value}
                  label={opt.label}
                  active={draft.statuses.includes(opt.value)}
                  onClick={() => setDraft(d => ({ ...d, statuses: toggleArray(d.statuses, opt.value) }))}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Account Size</label>
            {sizeOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No account sizes available yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map(opt => {
                  const num = Number(opt.value);
                  return (
                    <PillToggle
                      key={opt.value}
                      label={opt.label}
                      active={draft.sizes.includes(num)}
                      onClick={() => setDraft(d => ({ ...d, sizes: toggleArray(d.sizes, num) }))}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Account Type</label>
            <div className="flex flex-wrap gap-2">
              {STEP_OPTIONS.map(opt => (
                <PillToggle
                  key={opt.value}
                  label={opt.label}
                  active={draft.steps.includes(opt.value)}
                  onClick={() => setDraft(d => ({ ...d, steps: toggleArray(d.steps, opt.value) }))}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Strategy</label>
            <MultiSelectDropdown
              placeholder="Search strategies..."
              options={strategyOptions}
              selected={draft.strategies}
              onToggle={v => setDraft(d => ({ ...d, strategies: toggleArray(d.strategies, v) }))}
              formatLabel={n => `${n} strateg${n === 1 ? "y" : "ies"} selected`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset all
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
