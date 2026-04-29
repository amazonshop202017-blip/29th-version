import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppDatePicker } from '@/components/ui/app-date-pickers';

interface SelectDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: string) => void;
}

export const SelectDayModal = ({ open, onOpenChange, onConfirm }: SelectDayModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const handleConfirm = () => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      onConfirm(dateStr);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select date for Day Note</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <AppDatePicker value={selectedDate} onChange={setSelectedDate} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedDate}>
            Create Note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
