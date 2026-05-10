import { useState } from 'react';
import { Type, Hash, Calendar as CalendarIcon, ListChecks, ArrowLeft, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { FieldDef, FieldType } from '@/lib/backtestStore';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (field: FieldDef) => void;
  existingIds: string[];
}

const TYPE_CARDS: { type: FieldType; label: string; desc: string; icon: any }[] = [
  { type: 'text', label: 'Text', desc: 'Free-form text input', icon: Type },
  { type: 'number', label: 'Number', desc: 'Numeric value', icon: Hash },
  { type: 'date', label: 'Date', desc: 'Calendar date picker', icon: CalendarIcon },
  { type: 'select', label: 'Select', desc: 'Choose from options', icon: ListChecks },
];

export const AddFieldModal = ({ open, onOpenChange, onAdd, existingIds }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<FieldType>('text');
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(false);
  const [optionsRaw, setOptionsRaw] = useState('');

  const reset = () => { setStep(1); setType('text'); setLabel(''); setRequired(false); setOptionsRaw(''); };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    let id = slugify(trimmed) || `field_${Date.now()}`;
    let i = 1;
    while (existingIds.includes(id)) { id = `${slugify(trimmed)}_${i++}`; }
    const options = type === 'select'
      ? optionsRaw.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;
    if (type === 'select' && (!options || options.length === 0)) return;
    onAdd({ id, label: trimmed, type, required, options });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Choose the type of field to add.' : 'Configure the field details.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3 py-2">
            {TYPE_CARDS.map((c) => {
              const Icon = c.icon;
              const active = type === c.type;
              return (
                <button
                  key={c.type}
                  onClick={() => { setType(c.type); setStep(2); }}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:border-primary hover:bg-primary/5',
                    active ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-semibold text-sm">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.desc}</div>
                </button>
              );
            })}
          </div>
        ) : (
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
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={handleSave}
              disabled={!label.trim() || (type === 'select' && optionsRaw.split(',').map(o => o.trim()).filter(Boolean).length === 0)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add Field
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};