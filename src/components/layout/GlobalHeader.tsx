import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Wallet, Settings, Check, X, Filter, SlidersHorizontal, Globe, TrendingUp, Star, BarChart2, Clock, Percent, Hash, ListFilter, Calendar as CalendarIcon2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangeCalendar } from '@/components/layout/DateRangeCalendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useGlobalFilters, DatePreset, OutcomeFilter, DayFilter, LastTradesFilter, DirectionFilter, ReturnPercentRange, RMultipleRange, YearFilter } from '@/contexts/GlobalFiltersContext';
import { useAccountsContext } from '@/contexts/AccountsContext';
import { useTradesContext } from '@/contexts/TradesContext';
import { useStrategiesContext } from '@/contexts/StrategiesContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import { DisplayModeSelector } from './DisplayModeSelector';
import { useLocation } from 'react-router-dom';
import { useDashboardEdit } from '@/contexts/DashboardEditContext';
import { useSidebarCollapse } from '@/contexts/SidebarCollapseContext';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/trades': 'Trades',
  '/day-view': 'Day View',
  '/diary': 'Diary',
  '/strategies': 'Setups',
  '/reports': 'Reports',
  '/chart-room/drawdown': 'Drawdown',
  '/chart-room/consecutive': 'Consecutive W/L',
  '/chart-room/exit-analysis': 'Exit Analysis',
  '/chart-room/holding-time': 'Holding Time',
  '/chart-room/performance-by-symbol': 'Performance by Symbol',
  '/chart-room/performance-by-setup': 'Performance by Setup',
  '/chart-room/performance-by-time': 'Performance by Time',
  '/chart-room/tags-analytics': 'Tags Analytics',
  '/chart-room/risk-distribution': 'Risk Distribution',
  '/chart-room/trade-management': 'Trade Management',
  '/prop-firm': 'Prop Firm',
  '/exit-analyzer': 'Exit Analyzer',
};

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'ytd', label: 'YTD (year to date)' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00–${i.toString().padStart(2, '0')}:59`,
}));

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const OUTCOME_OPTIONS: { value: OutcomeFilter; label: string }[] = [
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'breakeven', label: 'Breakeven' },
];

const LAST_TRADES_OPTIONS: { value: LastTradesFilter; label: string }[] = [
  { value: null, label: 'All' },
  { value: 10, label: 'Last 10' },
  { value: 25, label: 'Last 25' },
  { value: 50, label: 'Last 50' },
  { value: 100, label: 'Last 100' },
];

const DIRECTION_OPTIONS: { value: DirectionFilter; label: string }[] = [
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
];

const RETURN_PERCENT_OPTIONS: { value: ReturnPercentRange; label: string }[] = [
  { value: '<0', label: '< 0%' },
  { value: '0-1', label: '0% – 1%' },
  { value: '1-2', label: '1% – 2%' },
  { value: '3-5', label: '3% – 5%' },
  { value: '5-10', label: '5% – 10%' },
  { value: '>10', label: '> 10%' },
];

const R_MULTIPLE_OPTIONS: { value: RMultipleRange; label: string }[] = [
  { value: '<-2', label: '< -2R' },
  { value: '-2-0', label: '-2R to 0R' },
  { value: '0-1', label: '0R to 1R' },
  { value: '1-2', label: '1R to 2R' },
  { value: '2-4', label: '2R to 4R' },
  { value: '>4', label: '> 4R' },
];

export const GlobalHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isEditMode, toggleEditMode } = useDashboardEdit();
  const { isCollapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapse();
  const isDashboard = location.pathname === '/';

  // Resolve page title from route
  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (PAGE_TITLES[path]) return PAGE_TITLES[path];
    // Handle sub-routes like /strategies/:id or /reports/*
    if (path.startsWith('/strategies/')) return 'Setup Detail';
    if (path.startsWith('/reports')) return 'Reports';
    return '';
  }, [location.pathname]);

  const { 
    dateRange, 
    setDateRange,
    datePreset,
    setDatePreset,
    applyDatePreset,
    selectedAccounts,
    setSelectedAccounts,
    isAllAccountsSelected,
    // Basic filters
    selectedSymbols,
    setSelectedSymbols,
    selectedOutcomes,
    setSelectedOutcomes,
    selectedHours,
    setSelectedHours,
    selectedSetups,
    setSelectedSetups,
    selectedDays,
    setSelectedDays,
    lastTradesFilter,
    setLastTradesFilter,
    selectedDirections,
    setSelectedDirections,
    selectedReturnRanges,
    setSelectedReturnRanges,
    selectedRMultipleRanges,
    setSelectedRMultipleRanges,
    selectedYear,
    setSelectedYear,
    selectedChecklistItems,
    setSelectedChecklistItems,
    hasActiveChecklistFilter,
    hasActiveTagFilters,
  } = useGlobalFilters();
  
  const { accounts, getActiveAccountsWithStats } = useAccountsContext();
  const { trades } = useTradesContext();
  const { strategies } = useStrategiesContext();
  
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [basicFiltersOpen, setBasicFiltersOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  
  // Mobile/tablet sheet states
  const [mobileDateSheetOpen, setMobileDateSheetOpen] = useState(false);
  const [mobileAdvancedSheetOpen, setMobileAdvancedSheetOpen] = useState(false);
  const [mobileAccountsSheetOpen, setMobileAccountsSheetOpen] = useState(false);

  // Get active accounts (excluding archived)
  const activeAccounts = useMemo(() => getActiveAccountsWithStats(), [getActiveAccountsWithStats]);

  // Get unique symbols from trades
  const availableSymbols = useMemo(() => {
    const symbols = new Set(trades.map(t => t.symbol));
    return Array.from(symbols).filter(Boolean).sort();
  }, [trades]);

  // Get available years from trades
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    trades.forEach(trade => {
      if (trade.entries && trade.entries.length > 0) {
        const firstEntry = trade.entries.sort((a, b) => 
          new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )[0];
        if (firstEntry?.datetime) {
          years.add(new Date(firstEntry.datetime).getFullYear());
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Descending
  }, [trades]);

  // Get checklist items for selected setups
  const availableChecklistItems = useMemo(() => {
    if (selectedSetups.length === 0) return [];
    // Get all checklist items from selected strategies
    const items = new Set<string>();
    strategies
      .filter(s => selectedSetups.includes(s.id))
      .forEach(s => {
        s.checklistItems?.forEach(item => items.add(item));
      });
    return Array.from(items);
  }, [strategies, selectedSetups]);

  const handlePresetClick = (preset: DatePreset) => {
    applyDatePreset(preset);
  };

  const handleCustomDateChange = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setDateRange({ from: range.from, to: range.to });
      setDatePreset('custom');
    }
  };

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      setSelectedAccounts(selectedAccounts.filter(a => a !== accountId));
    } else {
      setSelectedAccounts([...selectedAccounts, accountId]);
    }
  };

  const handleAllAccountsToggle = () => {
    setSelectedAccounts([]);
  };

  // Symbol filter handlers
  const handleSymbolToggle = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(i => i !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  // Outcome filter handlers
  const handleOutcomeToggle = (outcome: OutcomeFilter) => {
    if (selectedOutcomes.includes(outcome)) {
      setSelectedOutcomes(selectedOutcomes.filter(o => o !== outcome));
    } else {
      setSelectedOutcomes([...selectedOutcomes, outcome]);
    }
  };

  // Hour filter handlers
  const handleHourToggle = (hour: number) => {
    if (selectedHours.includes(hour)) {
      setSelectedHours(selectedHours.filter(h => h !== hour));
    } else {
      setSelectedHours([...selectedHours, hour]);
    }
  };

  // Setup filter handlers
  const handleSetupToggle = (setupId: string) => {
    if (selectedSetups.includes(setupId)) {
      setSelectedSetups(selectedSetups.filter(s => s !== setupId));
    } else {
      setSelectedSetups([...selectedSetups, setupId]);
    }
  };

  // Day filter handlers
  const handleDayToggle = (day: DayFilter) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Direction filter handlers
  const handleDirectionToggle = (direction: DirectionFilter) => {
    if (selectedDirections.includes(direction)) {
      setSelectedDirections(selectedDirections.filter(d => d !== direction));
    } else {
      setSelectedDirections([...selectedDirections, direction]);
    }
  };

  // Return % filter handlers
  const handleReturnRangeToggle = (range: ReturnPercentRange) => {
    if (selectedReturnRanges.includes(range)) {
      setSelectedReturnRanges(selectedReturnRanges.filter(r => r !== range));
    } else {
      setSelectedReturnRanges([...selectedReturnRanges, range]);
    }
  };

  // R-Multiple filter handlers
  const handleRMultipleRangeToggle = (range: RMultipleRange) => {
    if (selectedRMultipleRanges.includes(range)) {
      setSelectedRMultipleRanges(selectedRMultipleRanges.filter(r => r !== range));
    } else {
      setSelectedRMultipleRanges([...selectedRMultipleRanges, range]);
    }
  };

  // Year filter handler
  const handleYearSelect = (year: number | null) => {
    setSelectedYear(year);
    setYearPickerOpen(false);
  };

  // Checklist filter handlers
  const handleChecklistItemToggle = (item: string) => {
    if (selectedChecklistItems.includes(item)) {
      setSelectedChecklistItems(selectedChecklistItems.filter(i => i !== item));
    } else {
      setSelectedChecklistItems([...selectedChecklistItems, item]);
    }
  };

  const getDateRangeLabel = () => {
    if (datePreset === 'all' || (!dateRange.from && !dateRange.to)) {
      return 'All time';
    }
    if (datePreset !== 'custom') {
      return DATE_PRESETS.find(p => p.value === datePreset)?.label || 'Date range';
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
    }
    if (dateRange.from) {
      return `From ${format(dateRange.from, 'MMM dd, yyyy')}`;
    }
    return 'Date range';
  };

  const getAccountsLabel = () => {
    if (isAllAccountsSelected) {
      return 'All accounts';
    }
    if (selectedAccounts.length === 1) {
      const acc = accounts.find(a => a.id === selectedAccounts[0]);
      return acc?.name ?? 'Unknown Account';
    }
    return `${selectedAccounts.length} accounts`;
  };

  // Count active basic filters
  const activeBasicFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSymbols.length > 0) count++;
    if (selectedOutcomes.length > 0) count++;
    if (selectedHours.length > 0) count++;
    if (selectedSetups.length > 0) count++;
    if (selectedChecklistItems.length > 0) count++;
    if (selectedDays.length > 0) count++;
    if (lastTradesFilter !== null) count++;
    if (selectedDirections.length > 0) count++;
    if (selectedReturnRanges.length > 0) count++;
    if (selectedRMultipleRanges.length > 0) count++;
    if (selectedYear !== null) count++;
    return count;
  }, [selectedSymbols, selectedOutcomes, selectedHours, selectedSetups, selectedChecklistItems, selectedDays, lastTradesFilter, selectedDirections, selectedReturnRanges, selectedRMultipleRanges, selectedYear]);

  const totalActiveFilters = activeBasicFiltersCount + (hasActiveTagFilters ? 1 : 0) + (datePreset !== 'all' ? 1 : 0) + (!isAllAccountsSelected ? 1 : 0);

  return (
    <div className="flex items-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 bg-transparent pl-14 lg:pl-6 overflow-hidden">
      {/* Sidebar collapse/expand toggle (desktop only) */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-muted/60 border border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
      >
        {sidebarCollapsed ? <ChevronRight className="w-6 h-6" strokeWidth={2} /> : <ChevronLeft className="w-6 h-6" strokeWidth={2} />}
      </button>

      {/* Page Title */}
      {pageTitle && (
        <h1 className="text-sm md:text-base font-semibold text-foreground whitespace-nowrap mr-1 lg:mr-3">
          {pageTitle}
        </h1>
      )}

      {/* Mobile/Tablet: Single "Filters" menu button */}
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 bg-background border-border h-8 px-2.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Filters</span>
              {totalActiveFilters > 0 && (
                <span className="ml-0.5 px-1 py-0 text-[10px] rounded-full bg-primary text-primary-foreground leading-4">
                  {totalActiveFilters}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover border-border z-50">
            <DropdownMenuItem onClick={() => setBasicFiltersOpen(true)} className="cursor-pointer gap-2">
              <Filter className="w-4 h-4" />
              Basic Filters
              {activeBasicFiltersCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {activeBasicFiltersCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMobileAdvancedSheetOpen(true)} className="cursor-pointer gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Advanced Filters
              {hasActiveTagFilters && (
                <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  Tags
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setMobileDateSheetOpen(true)} className="cursor-pointer gap-2">
              <CalendarIcon className="w-4 h-4" />
              {getDateRangeLabel()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMobileAccountsSheetOpen(true)} className="cursor-pointer gap-2">
              <Wallet className="w-4 h-4" />
              {getAccountsLabel()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile/Tablet Sheets for filter panels */}
      {/* Basic Filters Sheet - reuses the same DropdownMenu with open state */}

      {/* Advanced Filters Sheet */}
      <Sheet open={mobileAdvancedSheetOpen} onOpenChange={setMobileAdvancedSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-auto p-0">
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="text-base font-semibold">Advanced Filters</SheetTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileAdvancedSheetOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="p-0">
            <AdvancedFiltersPanel />
          </div>
        </SheetContent>
      </Sheet>

      {/* Date Range Sheet */}
      <Sheet open={mobileDateSheetOpen} onOpenChange={setMobileDateSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] flex flex-col overflow-hidden">
          <SheetHeader className="pb-3 border-b border-border flex-shrink-0">
            <SheetTitle className="text-base font-semibold">Date Range</SheetTitle>
          </SheetHeader>
          <div className="flex flex-wrap gap-2 pt-3 flex-shrink-0">
            <button
              onClick={() => { applyDatePreset('all'); setMobileDateSheetOpen(false); }}
              className={cn("px-3 py-1.5 text-sm rounded-md border border-border transition-colors", datePreset === 'all' && "bg-primary text-primary-foreground border-primary")}
            >
              All time
            </button>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => { handlePresetClick(preset.value); setMobileDateSheetOpen(false); }}
                className={cn("px-3 py-1.5 text-sm rounded-md border border-border transition-colors", datePreset === preset.value && "bg-primary text-primary-foreground border-primary")}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {/* Selected range display */}
          <div className="flex items-center justify-center gap-2 text-sm py-2 flex-shrink-0">
            <span className="text-foreground font-medium">
              {dateRange.from ? format(dateRange.from, 'MMMM dd, yyyy') : '—'}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-foreground font-medium px-2 py-0.5 border border-primary rounded">
              {dateRange.to ? format(dateRange.to, 'MMMM dd, yyyy') : '—'}
            </span>
          </div>
          {/* Calendar - scrollable */}
          <div className="flex-1 overflow-y-auto flex justify-center pt-1">
            <DateRangeCalendar
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleCustomDateChange}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Accounts Sheet */}
      <Sheet open={mobileAccountsSheetOpen} onOpenChange={setMobileAccountsSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
          <SheetHeader className="flex flex-row items-center justify-between pb-3 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="text-base font-semibold">Accounts</SheetTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileAccountsSheetOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="space-y-2 pt-3">
            <div
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors", isAllAccountsSelected && "bg-accent")}
              onClick={handleAllAccountsToggle}
            >
              <Checkbox checked={isAllAccountsSelected} />
              <span className="text-sm font-medium">All accounts</span>
            </div>
            {activeAccounts.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-3 pt-2">My accounts</div>
                {activeAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors", selectedAccounts.includes(account.id) && "bg-accent")}
                    onClick={() => handleAccountToggle(account.id)}
                  >
                    <Checkbox checked={selectedAccounts.includes(account.id)} />
                    <span className="text-sm">{account.name}</span>
                  </div>
                ))}
              </>
            )}
            <div className="border-t border-border pt-2 mt-2">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm" onClick={() => { navigate('/settings?tab=accounts'); setMobileAccountsSheetOpen(false); }}>
                <Settings className="w-4 h-4" />
                Manage accounts
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Spacer to push all desktop filters to the right */}
      <div className="flex-1 hidden lg:block" />

      {/* Desktop: All filter buttons inline */}
      {/* Display Mode Selector */}
      <div className="hidden lg:block">
        <DisplayModeSelector />
      </div>

      {/* Grouped filter bar with shared border and vertical dividers */}
      <div className="hidden lg:flex items-center border border-border rounded-md bg-background h-[2.125rem] overflow-visible">
        {/* Basic Filters Dropdown */}
        <DropdownMenu open={basicFiltersOpen} onOpenChange={setBasicFiltersOpen}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 h-full px-3 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors rounded-l-[calc(0.375rem-1px)]">
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
              <span>Filters</span>
              {activeBasicFiltersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {activeBasicFiltersCount}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] lg:w-[900px] p-4 bg-popover border-border z-50 max-h-[80vh] overflow-auto">
          <div className="space-y-4">
            {/* Row 1: Core Trade Context - Symbol, Setup, Checklist of Setup, Outcome, Direction, Starred */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Symbol - Multi-select from trades */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3 h-3" />
                  Symbol
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedSymbols.length === 0 ? 'All' : `${selectedSymbols.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {availableSymbols.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2 text-center">No symbols found</div>
                      ) : (
                        availableSymbols.map((sym) => (
                          <div 
                            key={sym} 
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                            onClick={() => handleSymbolToggle(sym)}
                          >
                            <Checkbox checked={selectedSymbols.includes(sym)} />
                            <span className="text-sm">{sym}</span>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedSymbols.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedSymbols([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Setup - Multi-select from strategies */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BarChart2 className="w-3 h-3" />
                  Setup
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedSetups.length === 0 ? 'All' : `${selectedSetups.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {strategies.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2 text-center">No setups found</div>
                      ) : (
                        strategies.map((strategy) => (
                          <div 
                            key={strategy.id} 
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                            onClick={() => handleSetupToggle(strategy.id)}
                          >
                            <Checkbox checked={selectedSetups.includes(strategy.id)} />
                            <span className="text-sm truncate">{strategy.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedSetups.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedSetups([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Checklist of Setup - Depends on Setup selection */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ListFilter className="w-3 h-3" />
                  Checklist of Setup
                </label>
                <Popover open={checklistOpen} onOpenChange={setChecklistOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-9 justify-between text-sm font-normal bg-background border-border"
                      disabled={selectedSetups.length === 0}
                    >
                      {selectedSetups.length === 0 
                        ? 'Select setup first' 
                        : selectedChecklistItems.length === 0 
                          ? 'All' 
                          : `${selectedChecklistItems.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2 bg-popover border-border z-[70]" align="start">
                    {selectedSetups.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-3 text-center">
                        Please select a setup to choose checklist items.
                      </div>
                    ) : availableChecklistItems.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-3 text-center">
                        No checklist items for selected setups.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 max-h-48 overflow-auto">
                          {availableChecklistItems.map((item) => (
                            <div 
                              key={item} 
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                              onClick={() => handleChecklistItemToggle(item)}
                            >
                              <Checkbox checked={selectedChecklistItems.includes(item)} />
                              <span className="text-sm truncate">{item}</span>
                            </div>
                          ))}
                        </div>
                        {selectedChecklistItems.length > 0 && (
                          <>
                            <DropdownMenuSeparator className="my-2" />
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-xs"
                              onClick={() => setSelectedChecklistItems([])}
                            >
                              Clear selection
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Outcome - Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Outcome
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedOutcomes.length === 0 ? 'All' : `${selectedOutcomes.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1">
                      {OUTCOME_OPTIONS.map((option) => (
                        <div 
                          key={option.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => handleOutcomeToggle(option.value)}
                        >
                          <Checkbox checked={selectedOutcomes.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedOutcomes.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedOutcomes([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Direction - Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  Direction
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedDirections.length === 0 ? 'All' : `${selectedDirections.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1">
                      {DIRECTION_OPTIONS.map((option) => (
                        <div 
                          key={option.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => handleDirectionToggle(option.value)}
                        >
                          <Checkbox checked={selectedDirections.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedDirections.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedDirections([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Starred - UI only (not wired) */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Star className="w-3 h-3" />
                  Starred
                </label>
                <Select>
                  <SelectTrigger className="h-9 bg-background border-border">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-[60]">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="starred">Starred Only</SelectItem>
                    <SelectItem value="unstarred">Unstarred Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Time Context - Year, Month, Day, Hour, Last Trades, (empty) */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Year - Calendar-style year picker */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon2 className="w-3 h-3" />
                  Year
                </label>
                <Popover open={yearPickerOpen} onOpenChange={setYearPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedYear === null ? 'All' : selectedYear.toString()}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-3 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground text-center mb-2">Select Year</div>
                      <div 
                        className={cn(
                          "px-3 py-2 rounded-md text-center text-sm cursor-pointer transition-colors",
                          selectedYear === null ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                        onClick={() => handleYearSelect(null)}
                      >
                        All Years
                      </div>
                      <DropdownMenuSeparator />
                      <div className="grid grid-cols-2 gap-1.5">
                        {availableYears.length === 0 ? (
                          // Generate last 5 years if no trades
                          [0, 1, 2, 3, 4].map(offset => {
                            const year = new Date().getFullYear() - offset;
                            return (
                              <div
                                key={year}
                                className={cn(
                                  "px-3 py-2 rounded-md text-center text-sm cursor-pointer transition-colors",
                                  selectedYear === year ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                                )}
                                onClick={() => handleYearSelect(year)}
                              >
                                {year}
                              </div>
                            );
                          })
                        ) : (
                          availableYears.map(year => (
                            <div
                              key={year}
                              className={cn(
                                "px-3 py-2 rounded-md text-center text-sm cursor-pointer transition-colors",
                                selectedYear === year ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                              )}
                              onClick={() => handleYearSelect(year)}
                            >
                              {year}
                            </div>
                          ))
                        )}
                      </div>
                      {selectedYear !== null && (
                        <>
                          <DropdownMenuSeparator />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => handleYearSelect(null)}
                          >
                            Clear selection
                          </Button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Month - UI only (not wired) */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon2 className="w-3 h-3" />
                  Month
                </label>
                <Select>
                  <SelectTrigger className="h-9 bg-background border-border">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-[60]">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Day - Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon2 className="w-3 h-3" />
                  Day
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedDays.length === 0 ? 'All' : `${selectedDays.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1">
                      {DAY_OPTIONS.map((option) => (
                        <div 
                          key={option.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => handleDayToggle(option.value)}
                        >
                          <Checkbox checked={selectedDays.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedDays.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedDays([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Hour - Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Hour
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedHours.length === 0 ? 'All' : `${selectedHours.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1 max-h-48 overflow-auto">
                      {HOUR_OPTIONS.map((option) => (
                        <div 
                          key={option.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => handleHourToggle(option.value)}
                        >
                          <Checkbox checked={selectedHours.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedHours.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedHours([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Last Trades - Single select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Hash className="w-3 h-3" />
                  Last Trades
                </label>
                <Select 
                  value={lastTradesFilter === null ? 'all' : lastTradesFilter.toString()} 
                  onValueChange={(value) => setLastTradesFilter(value === 'all' ? null : parseInt(value) as LastTradesFilter)}
                >
                  <SelectTrigger className="h-9 bg-background border-border">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-[60]">
                    {LAST_TRADES_OPTIONS.map((option) => (
                      <SelectItem key={option.label} value={option.value === null ? 'all' : option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Empty placeholder for future use */}
              <div />
            </div>

            {/* Row 3: Performance Filters - Return %, R-Multiple Gain, RRR, (empty), (empty), (empty) */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Return % - Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Percent className="w-3 h-3" />
                  Return %
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedReturnRanges.length === 0 ? 'All' : `${selectedReturnRanges.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1">
                      {RETURN_PERCENT_OPTIONS.map((option) => (
                        <div 
                          key={option.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => handleReturnRangeToggle(option.value)}
                        >
                          <Checkbox checked={selectedReturnRanges.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedReturnRanges.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedReturnRanges([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* R-Multiple Gain - Multi-select */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Hash className="w-3 h-3" />
                  R-Multiple Gain
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 justify-between text-sm font-normal bg-background border-border">
                      {selectedRMultipleRanges.length === 0 ? 'All' : `${selectedRMultipleRanges.length} selected`}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-2 bg-popover border-border z-[70]" align="start">
                    <div className="space-y-1">
                      {R_MULTIPLE_OPTIONS.map((option) => (
                        <div 
                          key={option.value} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                          onClick={() => handleRMultipleRangeToggle(option.value)}
                        >
                          <Checkbox checked={selectedRMultipleRanges.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedRMultipleRanges.length > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setSelectedRMultipleRanges([])}
                        >
                          Clear selection
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* RRR - UI only (not wired) */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Percent className="w-3 h-3" />
                  RRR
                </label>
                <Select>
                  <SelectTrigger className="h-9 bg-background border-border">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-[60]">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">1:1</SelectItem>
                    <SelectItem value="2">1:2</SelectItem>
                    <SelectItem value="3">1:3+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Empty placeholders */}
              <div />
              <div />
              <div />
            </div>
          </div>
        </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* Advanced Filters Dropdown */}
        <Popover open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 h-full px-3 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
              <span>Advanced Filters</span>
              {hasActiveTagFilters && (
                <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  Tags
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 bg-popover border-border z-50">
            <AdvancedFiltersPanel />
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* Date Range Selector */}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 h-10 px-3 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{getDateRangeLabel()}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[800px] p-0 bg-popover border-border z-50" align="end">
            <div className="flex">
              {/* Calendar */}
              <div className="p-3 border-r border-border">
                {/* Selected range display - inline above calendars */}
                <div className="flex items-center justify-center gap-3 text-sm pb-2">
                  <span className="text-foreground font-medium">
                    {dateRange.from ? format(dateRange.from, 'MMMM dd, yyyy') : '—'}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground font-medium px-2 py-0.5 border border-primary rounded">
                    {dateRange.to ? format(dateRange.to, 'MMMM dd, yyyy') : '—'}
                  </span>
                </div>
                <DateRangeCalendar
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={handleCustomDateChange}
                />
              </div>
              {/* Presets */}
              <div className="p-2 min-w-[150px]">
                <button
                  onClick={() => {
                    applyDatePreset('all');
                    setDatePickerOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                    datePreset === 'all' && "bg-accent font-medium"
                  )}
                >
                  All time
                </button>
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      handlePresetClick(preset.value);
                      setDatePickerOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
                      datePreset === preset.value && "bg-accent font-medium"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* Account Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 h-10 px-3 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors rounded-r-[calc(0.375rem-1px)]">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{getAccountsLabel()}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border z-50 min-w-[200px]">
            <DropdownMenuCheckboxItem
              checked={isAllAccountsSelected}
              onCheckedChange={handleAllAccountsToggle}
              className="cursor-pointer"
            >
              All accounts
            </DropdownMenuCheckboxItem>
            
            {activeAccounts.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  My accounts
                </DropdownMenuLabel>
                {activeAccounts.map((account) => (
                  <DropdownMenuCheckboxItem
                    key={account.id}
                    checked={selectedAccounts.includes(account.id)}
                    onCheckedChange={() => handleAccountToggle(account.id)}
                    className="cursor-pointer"
                  >
                    {account.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => navigate('/settings?tab=accounts')}
              className="cursor-pointer"
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage accounts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dashboard Edit Button - after filter bar */}
      {isDashboard && (
        <button
          onClick={toggleEditMode}
          className={cn(
            "h-9 gap-1.5 px-3 flex-shrink-0 hidden lg:flex items-center justify-center rounded-lg border border-border/40 text-sm font-medium transition-colors",
            isEditMode
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {isEditMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          <span className="text-xs">{isEditMode ? 'Done' : 'Edit'}</span>
        </button>
      )}
    </div>
  );
};