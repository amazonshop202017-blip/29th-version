import { useState, useEffect } from 'react';
import { Plus, Wallet, Save } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Account, AccountMode } from '@/contexts/AccountsContext';
import { CURRENCIES, type CurrencyCode } from '@/contexts/GlobalFiltersContext';
import { useNavigate } from 'react-router-dom';

interface NewAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAccount: (data: {
    name: string;
    startingBalance: number;
    accountMode: AccountMode;
    currency: CurrencyCode;
  }) => void;
  onUpdateAccount?: (data: {
    id: string;
    name: string;
    startingBalance: number;
    accountMode: AccountMode;
    currency: CurrencyCode;
  }) => void;
  editingAccount?: Account | null;
  currencySymbol: string;
}

export const NewAccountModal = ({ open, onOpenChange, onCreateAccount, onUpdateAccount, editingAccount, currencySymbol }: NewAccountModalProps) => {
  const isEditing = !!editingAccount;
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [mode, setMode] = useState<AccountMode>('normal');

  useEffect(() => {
    if (open && editingAccount) {
      setName(editingAccount.name);
      setBalance(editingAccount.startingBalance.toString());
      setMode(editingAccount.accountMode || 'normal');
    }
  }, [open, editingAccount]);

  const resetForm = () => {
    setName('');
    setBalance('');
    setMode('normal');
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const isPropfirm = mode === 'propfirm';
  const canCreate = name.trim() && balance && parseFloat(balance) >= 0 && !isPropfirm;

  const handleSubmit = () => {
    if (!canCreate) return;
    const accountData = {
      name: name.trim(),
      startingBalance: parseFloat(balance) || 0,
      accountMode: mode,
    };
    if (isEditing && editingAccount && onUpdateAccount) {
      onUpdateAccount({ id: editingAccount.id, ...accountData });
    } else {
      onCreateAccount(accountData);
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", isEditing ? "bg-accent/10" : "bg-primary/10")}>
              {isEditing ? <Save className="h-5 w-5 text-accent" /> : <Plus className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <DialogTitle>{isEditing ? 'Edit Account' : 'Add New Account'}</DialogTitle>
              <DialogDescription>{isEditing ? 'Update your trading account details' : 'Set up your trading account'}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* Account Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
              Account Name
            </Label>
            <Input
              placeholder="My Trading Account"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-input border-border"
            />
          </div>

          {/* Starting Balance */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Starting Account Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
              <Input
                type="number"
                placeholder="10,000"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="bg-input border-border pl-7"
              />
            </div>
          </div>

          {/* Account Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Account Mode</Label>
            <div className="grid grid-cols-2 gap-0 rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setMode('normal')}
                className={cn(
                  "py-2.5 text-sm font-medium transition-colors",
                  mode === 'normal'
                    ? "bg-primary text-primary-foreground"
                    : "bg-input text-muted-foreground hover:text-foreground"
                )}
              >
                Normal Account
              </button>
              <button
                type="button"
                onClick={() => setMode('propfirm')}
                className={cn(
                  "py-2.5 text-sm font-medium transition-colors",
                  mode === 'propfirm'
                    ? "bg-propfirm text-propfirm-foreground"
                    : "bg-input text-muted-foreground hover:text-foreground"
                )}
              >
                Prop Firm
              </button>
            </div>

            {isPropfirm ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">
                  Prop firm accounts and challenges can be added through the Prop Firm page.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    handleOpenChange(false);
                    navigate('/propfirm');
                  }}
                >
                  Go to Prop Firm
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This account will show in Live Trading mode.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!canCreate}
            className="w-full gap-2"
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};