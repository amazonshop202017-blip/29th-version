import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}

export const AddBacktestSessionModal = ({ open, onOpenChange, onCreate }: Props) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setName(''); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>New Backtest Session</DialogTitle>
              <DialogDescription>Give this session a name to get started.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-sm font-medium">Session Name</Label>
          <Input
            autoFocus
            placeholder="e.g. Breakout Strategy v1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!name.trim()} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};