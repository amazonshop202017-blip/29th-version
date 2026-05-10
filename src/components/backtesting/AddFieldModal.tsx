import { Type, Hash, Calendar as CalendarIcon, ListChecks, Plus, Check } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { FIELD_CATALOG_GENERAL, FIELD_CATALOG_ADVANCE, type FieldDef, type FieldType } from '@/lib/backtestStore';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FieldDef[];
  onInsert: (field: FieldDef) => void;
  onRemove: (id: string) => void;
}

const TYPE_META: Record<FieldType, { label: string; icon: any }> = {
  text: { label: 'Text', icon: Type },
  number: { label: 'Number', icon: Hash },
  date: { label: 'Date', icon: CalendarIcon },
  select: { label: 'Select', icon: ListChecks },
};

const CATEGORIES: { id: string; name: string; color: string; fields: FieldDef[] }[] = [
  { id: 'general', name: 'General', color: 'hsl(var(--primary))', fields: FIELD_CATALOG_GENERAL },
  { id: 'advance', name: 'Advance', color: 'hsl(var(--chart-3, 280 70% 60%))', fields: FIELD_CATALOG_ADVANCE },
];

export const AddFieldModal = ({ open, onOpenChange, fields, onInsert, onRemove }: Props) => {
  const fieldIds = new Set(fields.map(f => f.id));

  const renderChip = (f: FieldDef) => {
    const active = fieldIds.has(f.id);
    const Icon = TYPE_META[f.type].icon;
    return (
      <button
        key={f.id}
        type="button"
        onClick={() => (active ? onRemove(f.id) : onInsert(f))}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
          active
            ? 'bg-primary/10 border-primary/40 text-foreground hover:bg-primary/15'
            : 'bg-background border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
        title={TYPE_META[f.type].label}
      >
        <Icon className="h-3 w-3 opacity-70" />
        <span>{f.label}</span>
        {active ? <Check className="h-3 w-3 text-primary" /> : <Plus className="h-3 w-3 opacity-60" />}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Fields Library</DialogTitle>
          <DialogDescription>
            Insert or remove fields used for trade entry. Your selection is saved for this session.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 pr-1 py-1 space-y-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cat.fields.map(renderChip)}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
