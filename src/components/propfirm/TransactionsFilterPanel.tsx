import { useMemo, useRef, useState, useEffect } from "react";
import { X, ChevronDown, Check, Search } from "lucide-react";
import { CATEGORY_LABELS, TxCategory } from "@/contexts/TransactionsContext";

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

function FirmMultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (firm: string) => void;
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
    () => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full border border-border rounded-lg px-3 py-2.5 bg-card hover:border-foreground/30 transition-colors"
      >
        <span className={`text-sm ${selected.length ? "text-foreground" : "text-muted-foreground"}`}>
          {selected.length ? `${selected.length} firm${selected.length === 1 ? "" : "s"} selected` : "Search firms..."}
        </span>
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search firms..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">No firms found</div>
            ) : (
              filtered.map((firm) => {
                const isSelected = selected.includes(firm);
                return (
                  <button
                    key={firm}
                    type="button"
                    onClick={() => onToggle(firm)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                  >
                    <span className="text-foreground">{firm}</span>
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

export type TransactionsFilters = {
  firms: string[];
  categories: (TxCategory | "uncategorized")[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  firmOptions: string[];
  filters: TransactionsFilters;
  onChange: (next: TransactionsFilters) => void;
};

const CATEGORY_OPTIONS: { value: TxCategory | "uncategorized"; label: string }[] = [
  { value: "payout", label: "Payout" },
  { value: "other_income", label: "Affiliate Income" },
  { value: "evaluation_fee", label: "Evaluation Fee" },
  { value: "activation_fee", label: "Activation Fee" },
  { value: "uncategorized", label: "Uncategorized" },
];

export function TransactionsFilterPanel({ open, onClose, firmOptions, filters, onChange }: Props) {
  if (!open) return null;

  const toggleFirm = (firm: string) => {
    const next = filters.firms.includes(firm)
      ? filters.firms.filter((f) => f !== firm)
      : [...filters.firms, firm];
    onChange({ ...filters, firms: next });
  };

  const toggleCategory = (cat: TxCategory | "uncategorized") => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 z-50 w-[460px] max-w-[calc(100vw-2rem)] bg-card rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Filters</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Firm</label>
            <FirmMultiSelect options={firmOptions} selected={filters.firms} onToggle={toggleFirm} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <PillToggle
                  key={opt.value}
                  label={opt.label}
                  active={filters.categories.includes(opt.value)}
                  onClick={() => toggleCategory(opt.value)}
                />
              ))}
            </div>
          </div>
          {(filters.firms.length > 0 || filters.categories.length > 0) && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => onChange({ firms: [], categories: [] })}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const UNCATEGORIZED_CATEGORIES: TxCategory[] = ["other_expense", "commission", "refund"];
