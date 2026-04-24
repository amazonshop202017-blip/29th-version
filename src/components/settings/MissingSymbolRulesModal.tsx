import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MissingSymbolInfo } from '@/lib/tradovateFillsImport';

interface MissingSymbolRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missing: MissingSymbolInfo[];
}

export function MissingSymbolRulesModal({
  open,
  onOpenChange,
  missing,
}: MissingSymbolRulesModalProps) {
  const navigate = useNavigate();

  const handleConfigure = () => {
    onOpenChange(false);
    navigate('/settings?tab=symbol-tick');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <DialogTitle>Symbol Configuration Required</DialogTitle>
          </div>
          <DialogDescription>
            Unable to import trades for the following symbols because PnL cannot
            be calculated without contract size.
          </DialogDescription>
        </DialogHeader>

        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Tick Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missing.map(item => (
                <TableRow key={item.symbol}>
                  <TableCell className="font-medium">{item.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.tickSize}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleConfigure}>Configure Symbol Rules</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
