import { useState, useRef, useMemo } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useSymbolTickSize } from '@/contexts/SymbolTickSizeContext';
import { importMT5Trades } from '@/lib/mt5Import';
import { importTradovateTrades } from '@/lib/tradovateImport';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

const IMPORT_SOURCES = [
  { value: 'MT5', label: 'MT5' },
  { value: 'MatchTrader', label: 'MatchTrader' },
  { value: 'Tradovate', label: 'Tradovate (Position History)' },
  { value: 'TradovateFills', label: 'Tradovate (Fills)' },
];

interface AccountImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountImportModal({ open, onOpenChange }: AccountImportModalProps) {
  const { accounts, getAccountBalanceBeforeTrades } = useAccountsContext();
  const { trades, bulkAddTrades } = useTradesContext();
  const { contractSizes, setContractSize, tickPipRules, addTickPipRule } = useSymbolTickSize();
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [importSource, setImportSource] = useState<string>('');
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Only show active (non-archived) accounts
  const activeAccounts = useMemo(() => 
    accounts.filter(a => !a.isArchived),
    [accounts]
  );
  
  // Determine accepted file types based on import source
  const acceptedFileTypes = useMemo(() => {
    if (importSource === 'MT5') {
      return '.csv,.htm,.html';
    }
    if (importSource === 'Tradovate' || importSource === 'TradovateFills') {
      return '.csv';
    }
    // Default accept for MatchTrader (will be expanded later)
    return '.csv,.htm,.html';
  }, [importSource]);
  
  // Validation: all fields must be filled
  const isFormValid = selectedAccountId && importSource && selectedFile;
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };
  
  const handleFileBrowseClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };
  
  const resetForm = () => {
    setSelectedAccountId('');
    setImportSource('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleSave = async () => {
    if (!isFormValid || !selectedFile) return;
    
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) {
      toast.error('Account not found');
      return;
    }
    
    if (importSource === 'MatchTrader') {
      toast.error('MatchTrader import is not yet implemented');
      return;
    }

    if (importSource === 'TradovateFills') {
      toast.error('Tradovate (Fills) import is not yet implemented');
      return;
    }

    if (importSource !== 'MT5' && importSource !== 'Tradovate') {
      toast.error('Invalid import source');
      return;
    }

    setIsImporting(true);

    try {
      // Get account balance BEFORE trades for Return % calculation
      const accountBalanceSnapshot = getAccountBalanceBeforeTrades(selectedAccountId);

      // Build set of existing imported-trade fingerprints for this account.
      // Comparison uses STORED fingerprints only — never recomputed.
      const existingFingerprints = new Set<string>(
        trades
          .filter(t => t.accountId === selectedAccountId && t.source === 'imported' && t.fingerprint)
          .map(t => t.fingerprint)
      );

      toast.info(`Importing trades from ${selectedFile.name}...`);

      const result =
        importSource === 'Tradovate'
          ? await importTradovateTrades(
              selectedFile,
              selectedAccountId,
              accountBalanceSnapshot,
              bulkAddTrades,
              contractSizes,
              existingFingerprints,
              // ensureSymbolRules: create per-account Symbol Tick/Pip rules
              // for any symbol that doesn't already have one. Runs BEFORE
              // trades are inserted.
              (rules) => {
                let added = 0;
                for (const r of rules) {
                  const exists = tickPipRules.some(
                    rule =>
                      rule.accountIds.includes(selectedAccountId) &&
                      rule.symbol === r.symbol
                  );
                  if (exists) continue;
                  addTickPipRule({
                    accountIds: [selectedAccountId],
                    symbol: r.symbol,
                    tickSize: r.tickSize,
                    contractSize: r.contractSize,
                  });
                  added++;
                }
                return { added };
              }
            )
          : await importMT5Trades(
              selectedFile,
              selectedAccountId,
              accountBalanceSnapshot,
              bulkAddTrades,
              contractSizes,
              existingFingerprints
            );

      if (result.success) {
        // Auto-register imported symbols with default contract size = 1
        // (skip for Tradovate — handled via tickPipRules above)
        if (importSource !== 'Tradovate') {
          result.importedSymbols.forEach(sym => {
            if (!(sym in contractSizes)) {
              setContractSize(sym, 1);
            }
          });
        }
        const parts: string[] = [`Imported ${result.tradesImported} trade${result.tradesImported !== 1 ? 's' : ''}`];
        if (result.duplicatesSkipped > 0) {
          parts.push(`${result.duplicatesSkipped} duplicate${result.duplicatesSkipped !== 1 ? 's' : ''} skipped`);
        }
        if (result.rowsSkipped > 0) {
          parts.push(`${result.rowsSkipped} row${result.rowsSkipped !== 1 ? 's' : ''} skipped`);
        }
        const symbolRulesAdded = (result as { symbolRulesAdded?: number }).symbolRulesAdded ?? 0;
        if (importSource === 'Tradovate' && symbolRulesAdded > 0) {
          parts.push(`${symbolRulesAdded} symbol rule${symbolRulesAdded !== 1 ? 's' : ''} added`);
        }
        toast.success(parts.join(' · '));
        resetForm();
        onOpenChange(false);
      } else {
        toast.error(result.errors[0] || 'Failed to import trades');
      }
    } catch (error) {
      toast.error('An unexpected error occurred during import');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Trades</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account-select">Import into Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger id="account-select" className="w-full bg-background">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                {activeAccounts.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No accounts available
                  </div>
                ) : (
                  activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Import Source Selection - Searchable Combobox */}
          <div className="space-y-2">
            <Label>Import Source</Label>
            <Popover open={sourcePopoverOpen} onOpenChange={setSourcePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={sourcePopoverOpen}
                  className="w-full justify-between bg-background"
                >
                  {importSource
                    ? IMPORT_SOURCES.find((source) => source.value === importSource)?.label
                    : "Select import source..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-popover border-border z-50" align="start">
                <Command>
                  <CommandInput placeholder="Search import source..." />
                  <CommandList>
                    <CommandEmpty>No import source found.</CommandEmpty>
                    <CommandGroup>
                      {IMPORT_SOURCES.map((source) => (
                        <CommandItem
                          key={source.value}
                          value={source.value}
                          onSelect={(currentValue) => {
                            setImportSource(currentValue === importSource ? '' : currentValue);
                            setSourcePopoverOpen(false);
                            // Reset file when source changes
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              importSource === source.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {source.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* File Selection */}
          <div className="space-y-2">
            <Label>Select File</Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={acceptedFileTypes}
              className="hidden"
            />
            <div
              onClick={handleFileBrowseClick}
              className={cn(
                "flex items-center justify-between p-3 border border-input rounded-md cursor-pointer transition-colors",
                "hover:bg-accent hover:text-accent-foreground hover:border-accent",
                "bg-background"
              )}
            >
              <div className="flex items-center gap-3">
                {selectedFile ? (
                  <>
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to browse files...</span>
                  </>
                )}
              </div>
              <Button type="button" variant="outline" size="sm">
                Browse
              </Button>
            </div>
            {importSource === 'MatchTrader' && (
              <p className="text-xs text-muted-foreground mt-1">
                MatchTrader import will be available in a future update.
              </p>
            )}
            {importSource === 'Tradovate' && (
              <p className="text-xs text-muted-foreground mt-1">
                Upload a Tradovate Positions CSV export.
              </p>
            )}
            {importSource === 'TradovateFills' && (
              <p className="text-xs text-muted-foreground mt-1">
                Tradovate (Fills) import will be available in a future update.
              </p>
            )}
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isFormValid || isImporting}
          >
            {isImporting ? 'Importing...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
