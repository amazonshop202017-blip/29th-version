import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import type { FieldDef } from '@/lib/backtestStore';
import { TypeableCombobox } from '@/components/trades/TypeableCombobox';
import { useTradedSymbols } from '@/hooks/useTradedSymbols';
import { useStrategiesContext } from '@/contexts/StrategiesContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FieldDef[];
  initialValues?: Record<string, string | number | null>;
  onSave: (values: Record<string, string | number | null>) => void;
  isEditing?: boolean;
}

export const AddTradeModal = ({ open, onOpenChange, fields, initialValues, onSave, isEditing }: Props) => {
  const [values, setValues] = useState<Record<string, string | number | null>>({});
  const symbolOptions = useTradedSymbols();
  const { strategies, addStrategy } = useStrategiesContext();
  const setupOptions = strategies.map(s => s.name);

  useEffect(() => {
    if (open) setValues(initialValues ?? {});
  }, [open, initialValues]);

  const setVal = (id: string, v: string | number | null) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const isValid = fields.every(f => {
    if (!f.required) return true;
    const v = values[f.id];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });

  const handleSave = () => {
    if (!isValid) return;
    onSave(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Trade' : 'Add Trade'}</DialogTitle>
          <DialogDescription>Fill in the fields configured for this session.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {fields.map((f) => {
            const v = values[f.id];
            return (
              <div key={f.id} className="space-y-2">
                <Label className="text-sm font-medium">
                  {f.label}{f.required && <span className="text-rose-500 ml-0.5">*</span>}
                </Label>
                {f.type === 'text' && (
                  f.id === 'symbol' ? (
                    <TypeableCombobox
                      value={(v as string) ?? ''}
                      onChange={(val) => setVal(f.id, val)}
                      options={symbolOptions}
                      onAddNew={(val) => setVal(f.id, val)}
                      placeholder="e.g., EURUSD, AAPL..."
                    />
                  ) : f.id === 'setup' ? (
                    <TypeableCombobox
                      value={(v as string) ?? ''}
                      onChange={(val) => setVal(f.id, val)}
                      options={setupOptions}
                      onAddNew={(val) => {
                        const name = val.trim();
                        if (name && !setupOptions.some(o => o.toLowerCase() === name.toLowerCase())) {
                          addStrategy(name, '');
                        }
                        setVal(f.id, name);
                      }}
                      placeholder="Select or type setup..."
                    />
                  ) : (
                    <Input value={(v as string) ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />
                  )
                )}
                {f.type === 'number' && (
                  <Input
                    type="number"
                    value={v === null || v === undefined ? '' : String(v)}
                    onChange={(e) => setVal(f.id, e.target.value === '' ? null : Number(e.target.value))}
                  />
                )}
                {f.type === 'date' && (
                  <AppDatePicker
                    value={(v as string) ?? ''}
                    onChange={(s) => setVal(f.id, s)}
                  />
                )}
                {f.type === 'select' && (
                  <Select value={(v as string) ?? ''} onValueChange={(val) => setVal(f.id, val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={!isValid} className="w-full gap-2">
            {isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Add Trade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};