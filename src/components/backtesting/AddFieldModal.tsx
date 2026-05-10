import { useState } from 'react';
import { Type, Hash, Calendar as CalendarIcon, ListChecks, ArrowLeft, Plus, Check, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DEFAULT_FIELDS, type FieldDef, type FieldType } from '@/lib/backtestStore';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FieldDef[];
  onInsert: (field: FieldDef) => void;
  onRemove: (id: string) => void;
}

type View = 'library' | 'pickType' | 'configure';

const TYPE_META: Record<FieldType, { label: string; icon: any }> = {
  text: { label: 'Text', icon: Type },
  number: { label: 'Number', icon: Hash },
  date: { label: 'Date', icon: CalendarIcon },
  select: { label: 'Select', icon: ListChecks },
};

const TYPE_CARDS: { type: FieldType; desc: string }[] = [
  { type: 'text', desc: 'Free-form text input' },
  { type: 'number', desc: 'Numeric value' },
  { type: 'date', desc: 'Calendar date picker' },
  { type: 'select', desc: 'Choose from options' },
];

export const AddFieldModal = ({ open, onOpenChange, fields, onInsert, onRemove }: Props) => {
  const [view, setView] = useState<View>('library');
  const [type, setType] = useState<FieldType>('text');
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(false);
  const [optionsRaw, setOptionsRaw] = useState('');

  const reset = () => {
    setView('library'); setType('text'); setLabel(''); setRequired(false); setOptionsRaw('');
  };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const fieldIds = new Set(fields.map(f => f.id));
  const customFields = fields.filter(f => !f.builtin);

  const handleCreateCustom = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    let id = slugify(trimmed) || `field_${Date.now()}`;
    let i = 1;
    while (fieldIds.has(id)) { id = `${slugify(trimmed)}_${i++}`; }
    const options = type === 'select'
      ? optionsRaw.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;
    if (type === 'select' && (!options || options.length === 0)) return;
    onInsert({ id, label: trimmed, type, required, options });
    setView('library');
    setType('text'); setLabel(''); setRequired(false); setOptionsRaw('');
  };

  const renderLibrary = () => (
    <div className="space-y-5 py-1">
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Default Fields</div>
        <div className="space-y-2">
          {DEFAULT_FIELDS.map((f) => {
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
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Custom Fields</div>
        {customFields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No custom fields yet.
          </div>
        ) : (
          <div className="space-y-2">
            {customFields.map((f) => {
              const Icon = TYPE_META[f.type].icon;
              return (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.label}</div>
                      <div className="text-xs text-muted-foreground">{TYPE_META[f.type].label}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-rose-500 hover:text-rose-600" onClick={() => onRemove(f.id)}>
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 mt-3 w-full" onClick={() => setView('pickType')}>
          <Plus className="h-3.5 w-3.5" /> Create custom field
        </Button>
      </div>
    </div>
  );

  const renderPickType = () => (
    <div className="grid grid-cols-2 gap-3 py-2">
      {TYPE_CARDS.map((c) => {
        const Icon = TYPE_META[c.type].icon;
        return (
          <button
            key={c.type}
            onClick={() => { setType(c.type); setView('configure'); }}
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-all hover:border-primary hover:bg-primary/5',
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="font-semibold text-sm">{TYPE_META[c.type].label}</div>
            <div className="text-xs text-muted-foreground">{c.desc}</div>
          </button>
        );
      })}
    </div>
  );

  const renderConfigure = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Label</Label>
        <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Setup, Session, Confidence" />
      </div>
      {type === 'select' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Options</Label>
          <Input value={optionsRaw} onChange={(e) => setOptionsRaw(e.target.value)} placeholder="Comma-separated, e.g. London, NY, Asia" />
        </div>
      )}
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <div className="text-sm font-medium">Required</div>
          <div className="text-xs text-muted-foreground">Block save when empty</div>
        </div>
        <Switch checked={required} onCheckedChange={setRequired} />
      </div>
    </div>
  );

  const titles: Record<View, { title: string; desc: string }> = {
    library: { title: 'Fields Library', desc: 'Insert or remove fields used for trade entry. Your selection is saved per session.' },
    pickType: { title: 'Pick a field type', desc: 'Choose what kind of data this field stores.' },
    configure: { title: 'Configure field', desc: 'Set the label and options for your custom field.' },
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{titles[view].title}</DialogTitle>
          <DialogDescription>{titles[view].desc}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 pr-1">
          {view === 'library' && renderLibrary()}
          {view === 'pickType' && renderPickType()}
          {view === 'configure' && renderConfigure()}
        </div>

        {view !== 'library' && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setView(view === 'configure' ? 'pickType' : 'library')} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {view === 'configure' && (
              <Button
                onClick={handleCreateCustom}
                disabled={!label.trim() || (type === 'select' && optionsRaw.split(',').map(o => o.trim()).filter(Boolean).length === 0)}
                className="gap-2"
              >
                <Check className="h-4 w-4" /> Create Field
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
