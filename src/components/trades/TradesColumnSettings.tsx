import { useState, useEffect, useMemo } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ALL_COLUMNS,
  ColumnConfig,
  ColumnGroup,
} from '@/hooks/useTradesColumnVisibility';

interface TradesColumnSettingsProps {
  columns: ColumnConfig[];
  columnGroups: ColumnGroup[];
  onToggleColumn: (columnId: string) => void;
}

export const TradesColumnSettings = ({
  columns,
  columnGroups,
  onToggleColumn,
}: TradesColumnSettingsProps) => {
  const [open, setOpen] = useState(false);
  // Draft visibility map keyed by column id — only committed on Apply
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  // Reset draft to current visibility every time the dialog is opened
  useEffect(() => {
    if (open) {
      const initial: Record<string, boolean> = {};
      columns.forEach((col) => {
        initial[col.id] = col.visible;
      });
      setDraft(initial);
    }
  }, [open, columns]);

  const getColumnsByGroup = (groupId: string) =>
    columns.filter((col) => col.group === groupId);

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    columns.forEach((col) => {
      next[col.id] = value;
    });
    setDraft(next);
  };

  const resetDefault = () => {
    const next: Record<string, boolean> = {};
    columns.forEach((col) => {
      const def = ALL_COLUMNS.find((c) => c.id === col.id);
      // dynamic columns (e.g. tag categories) default to false
      next[col.id] = def ? def.visible : false;
    });
    setDraft(next);
  };

  const handleToggle = (columnId: string) => {
    setDraft((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const handleApply = () => {
    // Diff draft vs current and toggle only changed columns
    columns.forEach((col) => {
      if (draft[col.id] !== col.visible) {
        onToggleColumn(col.id);
      }
    });
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="w-4 h-4" />
      </Button>

      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select columns</DialogTitle>
          <DialogDescription>
            Choose the columns you want to display in the table
          </DialogDescription>
          <div className="flex items-center gap-3 pt-1 text-sm">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="text-primary hover:underline font-medium"
            >
              All
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="text-primary hover:underline font-medium"
            >
              None
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={resetDefault}
              className="text-primary hover:underline font-medium"
            >
              Default
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <div className="space-y-5 py-2">
            {columnGroups.map((group, groupIndex) => {
              const groupColumns = getColumnsByGroup(group.id);
              if (groupColumns.length === 0) return null;
              return (
                <div key={group.id}>
                  {groupIndex > 0 && <Separator className="mb-4" />}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {groupColumns.map((column) => (
                      <div
                        key={column.id}
                        className="flex items-center space-x-2 min-w-0"
                      >
                        <Checkbox
                          id={`col-${column.id}`}
                          checked={draft[column.id] ?? column.visible}
                          onCheckedChange={() => handleToggle(column.id)}
                        />
                        <Label
                          htmlFor={`col-${column.id}`}
                          className="text-sm font-normal cursor-pointer truncate"
                          title={column.label}
                        >
                          {column.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-3 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
