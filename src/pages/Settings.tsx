import { useState, useCallback } from 'react';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { NewAccountModal } from '@/components/settings/NewAccountModal';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, X, Tag, Wallet, TrendingUp, TrendingDown, Settings as SettingsIcon, Download, DollarSign, FolderOpen, Archive, ArchiveRestore, ChevronDown, ChevronUp, Target, MessageSquare, Ruler, MoreVertical, ArrowRightLeft, Eraser, LogOut, Image, LayoutGrid, LayoutList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useGlobalFilters, CurrencyCode, CURRENCIES, BreakevenToleranceType } from '@/contexts/GlobalFiltersContext';
import { cn } from '@/lib/utils';
import DepositWithdrawModal from '@/components/settings/DepositWithdrawModal';
import { CategoriesManagement } from '@/components/settings/CategoriesManagement';
import { TagsManagement } from '@/components/settings/TagsManagement';
import { ScreenshotTagsManagement } from '@/components/settings/ScreenshotTagsManagement';
import { AccountImportModal } from '@/components/settings/AccountImportModal';
import { SymbolTickSizeManagement } from '@/components/settings/SymbolTickSizeManagement';
import { TpSlSettings } from '@/components/settings/TpSlSettings';
import { FeesSettings } from '@/components/settings/FeesSettings';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsTab } from '@/components/settings/SettingsSidebar';
import { AccountCard } from '@/components/settings/AccountCard';
import { calculateStatsFromTrades } from '@/lib/strategyStats';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { accounts, addAccount, updateAccount, getActiveAccountsWithStats, getArchivedAccountsWithStats, archiveAccount, unarchiveAccount, deleteAccountPermanently, addTransaction, getTransactionsForAccount } = useAccountsContext();
  const { trades, deleteTradesByAccountId } = useTradesContext();
  const { logout } = useAuth();
  const { currency, setCurrency, currencyConfig, breakevenTolerance, setBreakevenTolerance } = useGlobalFilters();

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setCurrency(newCurrency);
  };

  // Breakeven tolerance local state for input
  const [toleranceValue, setToleranceValue] = useState(breakevenTolerance.value.toString());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  
  const handleToleranceTypeChange = (type: BreakevenToleranceType) => {
    setBreakevenTolerance({
      ...breakevenTolerance,
      type,
    });
  };
  
  const handleToleranceValueChange = (value: string) => {
    setToleranceValue(value);
    const numValue = parseFloat(value) || 0;
    setBreakevenTolerance({
      ...breakevenTolerance,
      value: Math.max(0, numValue), // Ensure non-negative
    });
  };
  
  const handleBreakevenModeChange = (mode: 'automatic' | 'manual') => {
    setBreakevenTolerance({
      ...breakevenTolerance,
      mode,
    });
  };

  const activeSettingsTab = (searchParams.get('tab') as SettingsTab) || 'main';
  const setActiveSettingsTab = (tab: SettingsTab) => setSearchParams({ tab });
  
  // Custom Tags sub-tab state
  const [activeTagsSubTab, setActiveTagsSubTab] = useState<'categories' | 'tags' | 'screenshot-tags'>('categories');

  // Account state
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [editingAccountData, setEditingAccountData] = useState<import('@/contexts/AccountsContext').Account | null>(null);
  // Deposit/Withdraw modal state
  const [depositWithdrawAccountId, setDepositWithdrawAccountId] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Archived accounts toggle
  const [showArchivedAccounts, setShowArchivedAccounts] = useState(false);
  // Accounts view mode (card | table)
  const [accountsViewMode, setAccountsViewMode] = useState<'card' | 'table'>('card');

  const activeAccountsWithStats = getActiveAccountsWithStats();
  const archivedAccountsWithStats = getArchivedAccountsWithStats();

  const handleCreateAccount = (data: {
    name: string;
    startingBalance: number;
    accountMode: import('@/contexts/AccountsContext').AccountMode;
    currency: CurrencyCode;
  }) => {
    addAccount(data.name, data.startingBalance, data.accountMode, undefined, data.currency);
    toast.success(`Account "${data.name}" created`);
  };

  const handleUpdateAccount = (data: {
    id: string;
    name: string;
    startingBalance: number;
    accountMode: import('@/contexts/AccountsContext').AccountMode;
    currency: CurrencyCode;
  }) => {
    updateAccount(data.id, data.name, data.startingBalance, data.accountMode, data.currency);
    toast.success(`Account "${data.name}" updated`);
  };

  const startEditingAccount = (account: import('@/contexts/AccountsContext').Account) => {
    setEditingAccountData(account);
    setShowNewAccountModal(true);
  };

  return (
    <>
    <SettingsLayout activeTab={activeSettingsTab} onTabChange={setActiveSettingsTab}>
    <div className="space-y-8 animate-fade-in">
      {/* Main Tab Content */}
      {activeSettingsTab === 'main' && (
        <>
          {/* Currency Section */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Currency Settings</h2>
                <p className="text-sm text-muted-foreground">Set your preferred display currency for the journal</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Display Currency:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-background border-border min-w-[120px]">
                    <span className="text-lg font-semibold">{currencyConfig.symbol}</span>
                    <span>{currency}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover border-border z-50">
                  {Object.entries(CURRENCIES).map(([code, config]) => (
                    <DropdownMenuItem
                      key={code}
                      onClick={() => handleCurrencyChange(code as CurrencyCode)}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        currency === code && "bg-accent"
                      )}
                    >
                      <span className="w-6 text-center font-semibold">{config.symbol}</span>
                      <span>{code}</span>
                      {currency === code && <Check className="w-4 h-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="mt-4 text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 leading-relaxed">
              Note: This currency is only used when multiple accounts are selected in filters (or no account filter is applied).
              When a single account is selected, that account's own currency (set when the account was created) is used instead.
            </p>
          </div>

          {/* Breakeven Tolerance Section */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Breakeven Tolerance</h2>
                <p className="text-sm text-muted-foreground">Define how breakeven trades are classified</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Classification Mode */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground min-w-[120px]">Classification Mode:</span>
                <Select
                  value={breakevenTolerance.mode}
                  onValueChange={(value) => handleBreakevenModeChange(value as 'automatic' | 'manual')}
                >
                  <SelectTrigger className="w-[200px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automatic (Tolerance)</SelectItem>
                    <SelectItem value="manual">Manual (Trade-Level)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Only show tolerance settings in Automatic mode */}
              {breakevenTolerance.mode === 'automatic' && (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground min-w-[120px]">Tolerance Type:</span>
                    <Select
                      value={breakevenTolerance.type}
                      onValueChange={(value) => handleToleranceTypeChange(value as BreakevenToleranceType)}
                    >
                      <SelectTrigger className="w-[180px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">Amount ({currencyConfig.symbol})</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground min-w-[120px]">Tolerance Value:</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {breakevenTolerance.type === 'amount' ? `±${currencyConfig.symbol}` : '±'}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step={breakevenTolerance.type === 'amount' ? '1' : '0.01'}
                        placeholder="0"
                        value={toleranceValue}
                        onChange={(e) => handleToleranceValueChange(e.target.value)}
                        className="bg-input border-border w-40 pl-10"
                      />
                      {breakevenTolerance.type === 'percentage' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {breakevenTolerance.mode === 'manual' ? (
                    <>
                      Trades are classified as <span className="text-primary font-medium">breakeven</span> based on the "Breakeven" toggle in the Add/Edit Trade popup. Tolerance settings are ignored.
                    </>
                  ) : breakevenTolerance.type === 'amount' ? (
                    <>
                      Trades with P/L between <span className="font-mono text-foreground">-{currencyConfig.symbol}{breakevenTolerance.value}</span> and <span className="font-mono text-foreground">+{currencyConfig.symbol}{breakevenTolerance.value}</span> will be classified as <span className="text-primary font-medium">breakeven</span>.
                    </>
                  ) : (
                    <>
                      Trades with Return between <span className="font-mono text-foreground">-{breakevenTolerance.value}%</span> and <span className="font-mono text-foreground">+{breakevenTolerance.value}%</span> will be classified as <span className="text-primary font-medium">breakeven</span>.
                    </>
                  )}
                </p>
              </div>
              
              <div className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Win Rate Formula:</span> Wins ÷ (Wins + Losses) × 100%. Breakeven trades are excluded from win rate calculations.
                </p>
              </div>
            </div>
          </div>

        </>
      )}

      {/* Accounts Tab Content */}
      {activeSettingsTab === 'accounts' && (
        <>
          {/* Account Import Modal */}
          <AccountImportModal open={showImportModal} onOpenChange={setShowImportModal} />
          
          {/* Account Modal (New + Edit) */}
          <NewAccountModal
            open={showNewAccountModal}
            onOpenChange={(val) => {
              setShowNewAccountModal(val);
              if (!val) setEditingAccountData(null);
            }}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            editingAccount={editingAccountData}
            currencySymbol={currencyConfig.symbol}
          />

          {/* Accounts Section */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Accounts Management</h2>
                <p className="text-sm text-muted-foreground">Create and manage trading accounts with balance tracking</p>
              </div>
            </div>

            {activeAccountsWithStats.length === 0 && archivedAccountsWithStats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No accounts created yet</p>
                <p className="text-sm">Create your first account to start tracking balances</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* View toggle */}
                <div className="flex justify-end">
                  <div className="inline-flex border border-border rounded-lg p-1 gap-1">
                    <button
                      onClick={() => setAccountsViewMode('card')}
                      className={cn(
                        'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                        accountsViewMode === 'card' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                      )}
                      title="Card view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAccountsViewMode('table')}
                      className={cn(
                        'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                        accountsViewMode === 'table' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                      )}
                      title="Table view"
                    >
                      <LayoutList className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Active Accounts — Card view */}
                {accountsViewMode === 'card' && activeAccountsWithStats.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeAccountsWithStats.map((account) => {
                      const accountTrades = trades.filter(t => t.accountId === account.id);
                      const stats = calculateStatsFromTrades(accountTrades);
                      return (
                        <AccountCard
                          key={account.id}
                          account={account}
                          stats={stats}
                          currencySymbol={currencyConfig.symbol}
                          onEdit={() => startEditingAccount(account)}
                          onArchive={() => archiveAccount(account.id)}
                          onDepositWithdraw={() => setDepositWithdrawAccountId(account.id)}
                          onImport={() => setShowImportModal(true)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Active Accounts */}
                {accountsViewMode === 'table' && (
                <div className="space-y-2">
                  <AnimatePresence>
                    {activeAccountsWithStats.map((account) => (
                      <motion.div
                        key={account.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center justify-between p-4 bg-input rounded-lg border border-border"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                            <span className="font-medium truncate">{account.name}</span>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-6 text-sm flex-wrap">
                            <div className="text-muted-foreground">
                              <span className="text-xs">Starting:</span>{' '}
                              <span className="font-mono text-foreground">{currencyConfig.symbol}{account.startingBalance.toLocaleString()}</span>
                            </div>
                            <div className="text-muted-foreground">
                              <span className="text-xs">Current:</span>{' '}
                              <span className="font-mono text-foreground">{currencyConfig.symbol}{account.currentBalance.toLocaleString()}</span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1",
                              account.pnl >= 0 ? "text-profit" : "text-loss"
                            )}>
                              {account.pnl >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span className="font-mono text-sm">
                                {account.roi >= 0 ? '+' : ''}{account.roi.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border z-50 w-48">
                            <DropdownMenuItem onClick={() => setShowImportModal(true)} className="cursor-pointer">
                              <Download className="w-4 h-4 mr-2" />
                              Import
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDepositWithdrawAccountId(account.id)} className="cursor-pointer">
                              <DollarSign className="w-4 h-4 mr-2" />
                              Deposit / Withdraw
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => startEditingAccount(account)} className="cursor-pointer">
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => archiveAccount(account.id)} className="cursor-pointer">
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
                              <ArrowRightLeft className="w-4 h-4 mr-2" />
                              Transfer All Data
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
                              <Eraser className="w-4 h-4 mr-2" />
                              Clear Trades
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                )}

                {/* Archived Accounts Section */}
                {archivedAccountsWithStats.length > 0 && (
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowArchivedAccounts(!showArchivedAccounts)}
                      className="w-full justify-between h-10 mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4" />
                        <span>Archived Accounts ({archivedAccountsWithStats.length})</span>
                      </div>
                      {showArchivedAccounts ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                    
                    {showArchivedAccounts && (
                      <div className="space-y-2 mt-2">
                        <AnimatePresence>
                          {archivedAccountsWithStats.map((account) => {
                            const tradeCount = trades.filter(t => t.accountId === account.id).length;
                            
                            return (
                              <motion.div
                                key={account.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
                                    <span className="font-medium text-muted-foreground truncate">{account.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3 sm:gap-6 text-sm text-muted-foreground flex-wrap">
                                    <div>
                                      <span className="text-xs">Total P/L:</span>{' '}
                                      <span className={cn(
                                        "font-mono",
                                        account.pnl >= 0 ? "text-profit" : "text-loss"
                                      )}>
                                        {account.pnl >= 0 ? '+' : ''}{currencyConfig.symbol}{account.pnl.toLocaleString()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs">Trades:</span>{' '}
                                      <span className="font-mono">{tradeCount}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => unarchiveAccount(account.id)}
                                    className="h-7 text-xs gap-1"
                                    title="Unarchive account"
                                  >
                                    <ArchiveRestore className="w-3 h-3" />
                                    Unarchive
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeleteTarget({ id: account.id, name: account.name })}
                                    className="text-loss hover:text-loss h-7 text-xs gap-1"
                                    title="Permanently delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </Button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* New Account CTA */}
            <div className="mt-6">
              <Button
                onClick={() => setShowNewAccountModal(true)}
                className="w-full gap-2"
                size="lg"
              >
                <Plus className="w-4 h-4" />
                New Account
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Custom Tags Tab Content */}
      {activeSettingsTab === 'custom-tags' && (
        <div className="space-y-6">
          {/* Sub-tab Navigation */}
          <div className="flex gap-2 p-1 bg-muted/30 rounded-lg w-fit flex-wrap">
            <button
              onClick={() => setActiveTagsSubTab('categories')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTagsSubTab === 'categories'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <FolderOpen className="w-4 h-4" />
              Categories
            </button>
            <button
              onClick={() => setActiveTagsSubTab('tags')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTagsSubTab === 'tags'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Tag className="w-4 h-4" />
              Tags
            </button>
            <button
              onClick={() => setActiveTagsSubTab('screenshot-tags')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTagsSubTab === 'screenshot-tags'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Image className="w-4 h-4" />
              Screenshot Tags
            </button>
          </div>

          {/* Categories Sub-tab */}
          {activeTagsSubTab === 'categories' && (
            <div className="glass-card rounded-2xl p-6">
              <CategoriesManagement />
            </div>
          )}

          {/* Tags Sub-tab */}
          {activeTagsSubTab === 'tags' && (
            <div className="glass-card rounded-2xl p-6">
              <TagsManagement />
            </div>
          )}

          {/* Screenshot Tags Sub-tab */}
          {activeTagsSubTab === 'screenshot-tags' && (
            <div className="glass-card rounded-2xl p-6">
              <ScreenshotTagsManagement />
            </div>
          )}
        </div>
      )}

      {/* Symbol Tick / Pip Tab Content */}
      {activeSettingsTab === 'symbol-tick' && (
        <div className="glass-card rounded-2xl p-6">
          <SymbolTickSizeManagement />
        </div>
      )}

      {/* TP / SL Settings Tab Content */}
      {activeSettingsTab === 'tpsl' && (
        <TpSlSettings />
      )}

      {/* Fees Settings Tab Content */}
      {activeSettingsTab === 'fees' && (
        <FeesSettings />
      )}

      {/* Deposit/Withdraw Modal */}
      {depositWithdrawAccountId && (() => {
        const account = accounts.find(a => a.id === depositWithdrawAccountId);
        if (!account) return null;
        return (
          <DepositWithdrawModal
            isOpen={!!depositWithdrawAccountId}
            onClose={() => setDepositWithdrawAccountId(null)}
            accountId={depositWithdrawAccountId}
            accountName={account.name}
            transactions={getTransactionsForAccount(depositWithdrawAccountId)}
            onAddTransaction={(type, amount, note) => 
              addTransaction(depositWithdrawAccountId, type, amount, note)
            }
          />
        );
      })()}
    </div>
    </SettingsLayout>

    <DeleteAccountDialog
      open={!!deleteTarget}
      onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      accountName={deleteTarget?.name ?? ''}
      onConfirm={() => {
        if (deleteTarget) {
          deleteTradesByAccountId(deleteTarget.id);
          deleteAccountPermanently(deleteTarget.id);
          setDeleteTarget(null);
        }
      }}
    />
    </>
  );
};

export default Settings;
