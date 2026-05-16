import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, startOfQuarter, startOfYear } from 'date-fns';

export type CurrencyCode = 'USD' | 'EUR' | 'INR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
};

export type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_30_days' | 'last_month' | 'this_quarter' | 'ytd' | 'custom' | 'all';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type OutcomeFilter = 'win' | 'loss' | 'breakeven';
export type DayFilter = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type LastTradesFilter = 10 | 25 | 50 | 100 | null;
export type DirectionFilter = 'long' | 'short';
export type ReturnPercentRange = '<0' | '0-1' | '1-2' | '3-5' | '5-10' | '>10';
export type YearFilter = number | null; // null means "all years"
export type HoldingPeriodFilter = 'all' | 'intraday' | 'multiday';

// Display Mode for analytics values
export type DisplayMode = 'dollar' | 'percentage' | 'privacy' | 'tickpip';

// Breakeven Tolerance types
export type BreakevenToleranceType = 'amount' | 'percentage';
export type BreakevenModeType = 'automatic' | 'manual';

export interface BreakevenTolerance {
  type: BreakevenToleranceType;
  value: number; // Amount in currency OR percentage value
  mode: BreakevenModeType; // 'automatic' uses tolerance, 'manual' uses trade-level flag
}

// Tag filter: Map of categoryId -> array of selected tagIds
export type TagFilters = Record<string, string[]>;

// Trade Comments filter types
export type TradeCommentCategory = 'entryComments' | 'tradeManagements' | 'exitComments';
export type TradeCommentFilters = Record<TradeCommentCategory, string[]>;

// Trade outcome classification result
export type TradeOutcome = 'win' | 'loss' | 'breakeven';

interface GlobalFiltersContextType {
  // Currency
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  currencyConfig: CurrencyConfig;
  formatCurrency: (value: number, showSign?: boolean) => string;
  // Resolver bridge: lets AccountsContext provide a function that maps accountId -> currency
  setAccountCurrencyResolver: (fn: ((accountId: string) => CurrencyCode | undefined) | null) => void;
  
  // Breakeven Tolerance
  breakevenTolerance: BreakevenTolerance;
  setBreakevenTolerance: (tolerance: BreakevenTolerance) => void;
  // classifyTradeOutcome now accepts optional isBreakeven flag for manual mode
  classifyTradeOutcome: (netPnl: number, returnPercent?: number, isBreakeven?: boolean) => TradeOutcome;
  
  // Display Mode
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  
  // Date Range
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  datePreset: DatePreset;
  setDatePreset: (preset: DatePreset) => void;
  applyDatePreset: (preset: DatePreset) => void;
  
  // Account Filter
  selectedAccounts: string[];
  setSelectedAccounts: (accounts: string[]) => void;
  isAllAccountsSelected: boolean;
  
  // Basic Filters
  selectedSymbols: string[];
  setSelectedSymbols: (symbols: string[]) => void;
  selectedOutcomes: OutcomeFilter[];
  setSelectedOutcomes: (outcomes: OutcomeFilter[]) => void;
  selectedHours: number[];
  setSelectedHours: (hours: number[]) => void;
  selectedSetups: string[];
  setSelectedSetups: (setups: string[]) => void;
  excludedSetups: string[];
  setExcludedSetups: (setups: string[]) => void;
  selectedDays: DayFilter[];
  setSelectedDays: (days: DayFilter[]) => void;
  lastTradesFilter: LastTradesFilter;
  setLastTradesFilter: (count: LastTradesFilter) => void;
  selectedDirections: DirectionFilter[];
  setSelectedDirections: (directions: DirectionFilter[]) => void;
  selectedReturnRanges: ReturnPercentRange[];
  setSelectedReturnRanges: (ranges: ReturnPercentRange[]) => void;
  rMultipleMin: number | null;
  setRMultipleMin: (v: number | null) => void;
  rMultipleMax: number | null;
  setRMultipleMax: (v: number | null) => void;
  positionSizeMin: number | null;
  setPositionSizeMin: (v: number | null) => void;
  positionSizeMax: number | null;
  setPositionSizeMax: (v: number | null) => void;
  holdingPeriodFilter: HoldingPeriodFilter;
  setHoldingPeriodFilter: (v: HoldingPeriodFilter) => void;
  
  // Year Filter
  selectedYear: YearFilter;
  setSelectedYear: (year: YearFilter) => void;
  
  // Checklist of Setup Filter
  selectedChecklistItems: string[];
  setSelectedChecklistItems: (items: string[]) => void;
  hasActiveChecklistFilter: boolean;
  excludedChecklistItems: string[];
  setExcludedChecklistItems: (items: string[]) => void;
  // Advanced Filters - Tags
  selectedTagsByCategory: TagFilters;
  setSelectedTagsByCategory: (tags: TagFilters) => void;
  toggleCategoryTagFilter: (categoryId: string, tagId: string) => void;
  selectAllTagsInCategory: (categoryId: string, tagIds: string[]) => void;
  clearCategoryTags: (categoryId: string) => void;
  hasActiveTagFilters: boolean;
  
  // Advanced Filters - Trade Comments
  selectedTradeComments: TradeCommentFilters;
  setSelectedTradeComments: (comments: TradeCommentFilters) => void;
  toggleTradeCommentCategory: (category: TradeCommentCategory) => void;
  toggleTradeComment: (category: TradeCommentCategory, comment: string) => void;
  selectAllCommentsInCategory: (category: TradeCommentCategory, comments: string[]) => void;
  clearTradeCommentCategory: (category: TradeCommentCategory) => void;
  hasActiveTradeCommentFilters: boolean;
}

const GlobalFiltersContext = createContext<GlobalFiltersContextType | undefined>(undefined);

// LocalStorage keys
const CURRENCY_STORAGE_KEY = 'trading-journal-currency';
const DISPLAY_MODE_STORAGE_KEY = 'trading-journal-display-mode';
const BREAKEVEN_TOLERANCE_STORAGE_KEY = 'trading-journal-breakeven-tolerance';

// Default breakeven tolerance
const DEFAULT_BREAKEVEN_TOLERANCE: BreakevenTolerance = {
  type: 'amount',
  value: 0,
  mode: 'automatic', // Default to automatic (tolerance-based)
};

// Load persisted currency from localStorage
const loadPersistedCurrency = (): CurrencyCode => {
  try {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && (stored === 'USD' || stored === 'EUR' || stored === 'INR')) {
      return stored as CurrencyCode;
    }
  } catch (e) {
    console.warn('Failed to load currency preference:', e);
  }
  return 'USD';
};

// Load persisted breakeven tolerance from localStorage
const loadPersistedBreakevenTolerance = (): BreakevenTolerance => {
  try {
    const stored = localStorage.getItem(BREAKEVEN_TOLERANCE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.type && typeof parsed.value === 'number') {
        // Ensure mode is set (backwards compatibility)
        return {
          type: parsed.type,
          value: parsed.value,
          mode: parsed.mode || 'automatic',
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load breakeven tolerance:', e);
  }
  return DEFAULT_BREAKEVEN_TOLERANCE;
};

// Load persisted display mode from localStorage
const loadPersistedDisplayMode = (): DisplayMode => {
  try {
    const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
    if (stored && ['dollar', 'percentage', 'privacy', 'tickpip'].includes(stored)) {
      return stored as DisplayMode;
    }
  } catch (e) {
    console.warn('Failed to load display mode preference:', e);
  }
  return 'dollar';
};

export const GlobalFiltersProvider = ({ children }: { children: ReactNode }) => {
  // Currency state - load from localStorage
  const [currency, setCurrencyState] = useState<CurrencyCode>(loadPersistedCurrency);

  // Account currency resolver bridge (set by AccountsContext via a small bridge component)
  const [accountCurrencyResolver, setAccountCurrencyResolverState] = useState<((accountId: string) => CurrencyCode | undefined) | null>(null);
  const setAccountCurrencyResolver = useCallback((fn: ((accountId: string) => CurrencyCode | undefined) | null) => {
    // Wrap in a setter callback because functions in useState are interpreted as updaters.
    setAccountCurrencyResolverState(() => fn);
  }, []);
  
  // Breakeven tolerance state - load from localStorage
  const [breakevenTolerance, setBreakevenToleranceState] = useState<BreakevenTolerance>(loadPersistedBreakevenTolerance);
  
  // Display mode state - load from localStorage
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(loadPersistedDisplayMode);
  
  // Date range state - default to all time (undefined)
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  
  // Account filter state - empty array means "all accounts"
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  
  // Basic filters state
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState<OutcomeFilter[]>([]);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [selectedSetups, setSelectedSetups] = useState<string[]>([]);
  const [excludedSetups, setExcludedSetups] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<DayFilter[]>([]);
  const [lastTradesFilter, setLastTradesFilter] = useState<LastTradesFilter>(null);
  const [selectedDirections, setSelectedDirections] = useState<DirectionFilter[]>([]);
  const [selectedReturnRanges, setSelectedReturnRanges] = useState<ReturnPercentRange[]>([]);
  const [rMultipleMin, setRMultipleMin] = useState<number | null>(null);
  const [rMultipleMax, setRMultipleMax] = useState<number | null>(null);
  const [positionSizeMin, setPositionSizeMin] = useState<number | null>(null);
  const [positionSizeMax, setPositionSizeMax] = useState<number | null>(null);
  const [holdingPeriodFilter, setHoldingPeriodFilter] = useState<HoldingPeriodFilter>('all');
  
  // Year Filter
  const [selectedYear, setSelectedYear] = useState<YearFilter>(null);
  
  // Checklist of Setup Filter
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<string[]>([]);
  const [excludedChecklistItems, setExcludedChecklistItems] = useState<string[]>([]);
  
  // Advanced Filters - Tags
  const [selectedTagsByCategory, setSelectedTagsByCategory] = useState<TagFilters>({});
  
  // Advanced Filters - Trade Comments
  const [selectedTradeComments, setSelectedTradeComments] = useState<TradeCommentFilters>({
    entryComments: [],
    tradeManagements: [],
    exitComments: [],
  });

  // Persist currency to localStorage
  const setCurrency = useCallback((newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
    } catch (e) {
      console.warn('Failed to save currency preference:', e);
    }
  }, []);

  // Persist breakeven tolerance to localStorage
  const setBreakevenTolerance = useCallback((tolerance: BreakevenTolerance) => {
    setBreakevenToleranceState(tolerance);
    try {
      localStorage.setItem(BREAKEVEN_TOLERANCE_STORAGE_KEY, JSON.stringify(tolerance));
    } catch (e) {
      console.warn('Failed to save breakeven tolerance:', e);
    }
  }, []);

  // Persist display mode to localStorage
  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    try {
      localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save display mode preference:', e);
    }
  }, []);

  // Classify trade outcome based on mode and tolerance
  // isBreakeven is the trade-level flag from the Add/Edit Trade popup
  const classifyTradeOutcome = useCallback((netPnl: number, returnPercent?: number, isBreakeven?: boolean): TradeOutcome => {
    const { type, value, mode } = breakevenTolerance;
    
    // Manual mode: Use trade-level breakeven flag
    if (mode === 'manual') {
      if (isBreakeven === true) {
        return 'breakeven';
      }
      // If not marked as breakeven, classify by P/L
      if (netPnl > 0) return 'win';
      if (netPnl < 0) return 'loss';
      return 'breakeven'; // Exactly zero is always breakeven
    }
    
    // Automatic mode: Use tolerance-based logic
    if (type === 'amount') {
      // Amount-based tolerance: P/L between -value and +value is breakeven
      if (netPnl >= -value && netPnl <= value) {
        return 'breakeven';
      }
    } else if (type === 'percentage' && returnPercent !== undefined) {
      // Percentage-based tolerance: Return % between -value and +value is breakeven
      if (returnPercent >= -value && returnPercent <= value) {
        return 'breakeven';
      }
    }
    
    // If outside tolerance range
    if (netPnl > 0) return 'win';
    if (netPnl < 0) return 'loss';
    return 'breakeven'; // Exactly zero is always breakeven
  }, [breakevenTolerance]);
  
  // Toggle a single tag in a category
  const toggleCategoryTagFilter = (categoryId: string, tagId: string) => {
    setSelectedTagsByCategory(prev => {
      const categoryTags = prev[categoryId] || [];
      if (categoryTags.includes(tagId)) {
        const newCategoryTags = categoryTags.filter(id => id !== tagId);
        if (newCategoryTags.length === 0) {
          const { [categoryId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [categoryId]: newCategoryTags };
      } else {
        return { ...prev, [categoryId]: [...categoryTags, tagId] };
      }
    });
  };
  
  // Select all tags in a category
  const selectAllTagsInCategory = (categoryId: string, tagIds: string[]) => {
    setSelectedTagsByCategory(prev => ({ ...prev, [categoryId]: tagIds }));
  };
  
  // Clear all tags in a category
  const clearCategoryTags = (categoryId: string) => {
    setSelectedTagsByCategory(prev => {
      const { [categoryId]: _, ...rest } = prev;
      return rest;
    });
  };
  
  // Check if any tag filters are active
  const hasActiveTagFilters = Object.keys(selectedTagsByCategory).some(
    categoryId => selectedTagsByCategory[categoryId]?.length > 0
  );
  
  // Trade Comments filter functions
  const toggleTradeCommentCategory = (category: TradeCommentCategory) => {
    setSelectedTradeComments(prev => {
      if (prev[category].length > 0) {
        return { ...prev, [category]: [] };
      }
      return prev;
    });
  };
  
  const toggleTradeComment = (category: TradeCommentCategory, comment: string) => {
    setSelectedTradeComments(prev => {
      const categoryComments = prev[category] || [];
      if (categoryComments.includes(comment)) {
        return { ...prev, [category]: categoryComments.filter(c => c !== comment) };
      } else {
        return { ...prev, [category]: [...categoryComments, comment] };
      }
    });
  };
  
  const selectAllCommentsInCategory = (category: TradeCommentCategory, comments: string[]) => {
    setSelectedTradeComments(prev => ({ ...prev, [category]: comments }));
  };
  
  const clearTradeCommentCategory = (category: TradeCommentCategory) => {
    setSelectedTradeComments(prev => ({ ...prev, [category]: [] }));
  };
  
  // Check if any trade comment filters are active
  const hasActiveTradeCommentFilters = 
    selectedTradeComments.entryComments.length > 0 ||
    selectedTradeComments.tradeManagements.length > 0 ||
    selectedTradeComments.exitComments.length > 0;

  // Effective currency: use single-account's own currency when exactly one account is filtered,
  // otherwise fall back to the global setting.
  const effectiveCurrency: CurrencyCode = (() => {
    if (selectedAccounts.length === 1 && accountCurrencyResolver) {
      const c = accountCurrencyResolver(selectedAccounts[0]);
      if (c) return c;
    }
    return currency;
  })();
  const currencyConfig = CURRENCIES[effectiveCurrency];

  const formatCurrency = (value: number, showSign: boolean = true): string => {
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat(currencyConfig.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
    
    if (showSign) {
      const sign = value >= 0 ? '+' : '-';
      return `${sign}${currencyConfig.symbol}${formatted}`;
    }
    
    return `${value < 0 ? '-' : ''}${currencyConfig.symbol}${formatted}`;
  };

  const applyDatePreset = (preset: DatePreset) => {
    const now = new Date();
    let from: Date | undefined;
    let to: Date | undefined = endOfDay(now);

    switch (preset) {
      case 'today':
        from = startOfDay(now);
        break;
      case 'this_week':
        from = startOfWeek(now, { weekStartsOn: 0 });
        to = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'this_month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'last_30_days':
        from = subDays(startOfDay(now), 29);
        break;
      case 'last_month':
        const lastMonth = subDays(startOfMonth(now), 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case 'this_quarter':
        from = startOfQuarter(now);
        break;
      case 'ytd':
        from = startOfYear(now);
        break;
      case 'all':
      case 'custom':
      default:
        from = undefined;
        to = undefined;
        break;
    }

    setDatePreset(preset);
    setDateRange({ from, to });
  };

  const isAllAccountsSelected = selectedAccounts.length === 0;
  
  // Check if checklist filter is active
  const hasActiveChecklistFilter = selectedChecklistItems.length > 0 || excludedChecklistItems.length > 0;

  const value = useMemo(() => ({
    currency,
    setCurrency,
    currencyConfig,
    formatCurrency,
    setAccountCurrencyResolver,
    breakevenTolerance,
    setBreakevenTolerance,
    classifyTradeOutcome,
    displayMode,
    setDisplayMode,
    dateRange,
    setDateRange,
    datePreset,
    setDatePreset,
    applyDatePreset,
    selectedAccounts,
    setSelectedAccounts,
    isAllAccountsSelected,
    // Basic Filters
    selectedSymbols,
    setSelectedSymbols,
    selectedOutcomes,
    setSelectedOutcomes,
    selectedHours,
    setSelectedHours,
    selectedSetups,
    setSelectedSetups,
    excludedSetups,
    setExcludedSetups,
    selectedDays,
    setSelectedDays,
    lastTradesFilter,
    setLastTradesFilter,
    selectedDirections,
    setSelectedDirections,
    selectedReturnRanges,
    setSelectedReturnRanges,
    rMultipleMin,
    setRMultipleMin,
    rMultipleMax,
    setRMultipleMax,
    positionSizeMin,
    setPositionSizeMin,
    positionSizeMax,
    setPositionSizeMax,
    holdingPeriodFilter,
    setHoldingPeriodFilter,
    // Year Filter
    selectedYear,
    setSelectedYear,
    // Checklist of Setup Filter
    selectedChecklistItems,
    setSelectedChecklistItems,
    hasActiveChecklistFilter,
    excludedChecklistItems,
    setExcludedChecklistItems,
    // Advanced Filters - Tags
    selectedTagsByCategory,
    setSelectedTagsByCategory,
    toggleCategoryTagFilter,
    selectAllTagsInCategory,
    clearCategoryTags,
    hasActiveTagFilters,
    // Advanced Filters - Trade Comments
    selectedTradeComments,
    setSelectedTradeComments,
    toggleTradeCommentCategory,
    toggleTradeComment,
    selectAllCommentsInCategory,
    clearTradeCommentCategory,
    hasActiveTradeCommentFilters,
  }), [
    currency, 
    setCurrency,
    currencyConfig,
    setAccountCurrencyResolver,
    accountCurrencyResolver, 
    breakevenTolerance,
    setBreakevenTolerance,
    classifyTradeOutcome,
    displayMode,
    setDisplayMode,
    dateRange, 
    datePreset, 
    selectedAccounts,
    selectedSymbols,
    selectedOutcomes,
    selectedHours,
    selectedSetups,
    excludedSetups,
    selectedDays,
    lastTradesFilter,
    selectedDirections,
    selectedReturnRanges,
    rMultipleMin,
    rMultipleMax,
    positionSizeMin,
    positionSizeMax,
    holdingPeriodFilter,
    selectedYear,
    selectedChecklistItems,
    hasActiveChecklistFilter,
    excludedChecklistItems,
    selectedTagsByCategory,
    hasActiveTagFilters,
    selectedTradeComments,
    hasActiveTradeCommentFilters,
  ]);

  return (
    <GlobalFiltersContext.Provider value={value}>
      {children}
    </GlobalFiltersContext.Provider>
  );
};

export const useGlobalFilters = (): GlobalFiltersContextType => {
  const context = useContext(GlobalFiltersContext);
  if (context === undefined) {
    throw new Error('useGlobalFilters must be used within GlobalFiltersProvider');
  }
  return context;
};
