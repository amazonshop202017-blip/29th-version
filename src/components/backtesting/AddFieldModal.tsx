import { Type, Hash, Calendar as CalendarIcon, ListChecks, Plus, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FIELD_CATALOG_GENERAL, FIELD_CATALOG_ADVANCE, type FieldDef, type FieldType } from '@/lib/backtestStore';

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

export const AddFieldModal = ({ open, onOpenChange, fields, onInsert, onRemove }: Props) => {
  const fieldIds = new Set(fields.map(f => f.id));

  const renderField = (f: FieldDef) => {
    const active = fieldIds.has(f.id);
    const Icon = TYPE_META[f.type].icon;
    return (
      <div key={f.id} className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium flex items-center gap-2">
              {f.label}
              {f.required && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">recommended</span>}
            </div>
            <div className="text-xs text-muted-foreground">{TYPE_META[f.type].label}</div>
          </div>
        </div>
        {active ? (
          <Button size="sm" variant="outline" className="gap-1.5 text-rose-500 hover:text-rose-600" onClick={() => onRemove(f.id)}>
            <X className="h-3.5 w-3.5" /> Remove
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={() => onInsert(f)}>
            <Plus className="h-3.5 w-3.5" /> Insert
          </Button>
        )}
      </div>
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

        <div className="overflow-y-auto flex-1 min-h-0 pr-1 py-1 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">General</h3>
            <div className="space-y-2">{FIELD_CATALOG_GENERAL.map(renderField)}</div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advance</h3>
            <div className="space-y-2">{FIELD_CATALOG_ADVANCE.map(renderField)}</div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
