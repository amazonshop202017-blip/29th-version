import { useState, useMemo } from 'react';
import { ChevronDown, Check, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { useFilteredTrades } from '@/hooks/useFilteredTrades';
import { CompareGroupFiltersPanel } from './CompareGroupFiltersPanel';
import { getMatchedTradesCount } from '@/lib/compareUtils';
import { AppDatePicker } from '@/components/ui/AppDatePicker';

export interface CompareGroupFilters {
  symbols: string[];
  side: 'all' | 'long' | 'short';
  tradePnL: 'all' | 'win' | 'loss';
  tagsByCategory: Record<string, string[]>;
  tradeComments: {
    entryComments: string[];
    tradeManagements: string[];
    exitComments: string[];
  };
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface CompareGroupCardProps {
  groupNumber: 1 | 2;
  filters: CompareGroupFilters;
  onFiltersChange: (filters: CompareGroupFilters) => void;
}

export const CompareGroupCard = ({ groupNumber, filters, onFiltersChange }: CompareGroupCardProps) => {
  const { trades } = useFilteredTrades();
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);

  // Get unique symbols from trades
  const availableSymbols = useMemo((): string[] => {
    const symbols = new Set(trades.map(t => t.symbol));
    return Array.from(symbols).filter((s): s is string => Boolean(s)).sort();
  }, [trades]);

  const handleSymbolToggle = (symbol: string) => {
    const newSymbols = filters.symbols.includes(symbol)
      ? filters.symbols.filter(s => s !== symbol)
      : [...filters.symbols, symbol];
    onFiltersChange({ ...filters, symbols: newSymbols });
  };

  const handleSymbolRemove = (symbol: string) => {
    onFiltersChange({ ...filters, symbols: filters.symbols.filter(s => s !== symbol) });
  };

  const handleSideChange = (side: 'all' | 'long' | 'short') => {
    onFiltersChange({ ...filters, side });
  };

  const handleTradePnLChange = (tradePnL: 'all' | 'win' | 'loss') => {
    onFiltersChange({ ...filters, tradePnL });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    onFiltersChange({ ...filters, startDate: date });
  };

  const handleEndDateChange = (date: Date | undefined) => {
    onFiltersChange({ ...filters, endDate: date });
  };

  const handleTagsChange = (tagsByCategory: Record<string, string[]>) => {
    onFiltersChange({ ...filters, tagsByCategory });
  };

  const handleCommentsChange = (tradeComments: CompareGroupFilters['tradeComments']) => {
    onFiltersChange({ ...filters, tradeComments });
  };

  // Count selected tags and comments for display
  const selectedTagsCount = useMemo(() => {
    const tagCount = Object.values(filters.tagsByCategory).reduce((sum, tags) => sum + tags.length, 0);
    const commentCount = 
      filters.tradeComments.entryComments.length +
      filters.tradeComments.tradeManagements.length +
      filters.tradeComments.exitComments.length;
    return tagCount + commentCount;
  }, [filters.tagsByCategory, filters.tradeComments]);

  // Get matched trades count
  const matchedCount = useMemo(() => 
    getMatchedTradesCount(trades, filters), 
    [trades, filters]
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6">
        Group #{groupNumber} ({matchedCount} Trades Matched)
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Symbol */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Symbol</label>
            <Popover open={symbolOpen} onOpenChange={setSymbolOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={symbolOpen}
                  className="flex-1 justify-start h-auto min-h-10 bg-background border-border py-2"
                >
                  {filters.symbols.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filters.symbols.map((symbol) => (
                        <span
                          key={symbol}
                          className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs"
                        >
                          {symbol}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSymbolRemove(symbol);
                            }}
                            className="hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select...</span>
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0 bg-popover border-border z-[100]" align="start">
                <Command>
                  <CommandInput placeholder="Search symbol..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No symbols found.</CommandEmpty>
                    <CommandGroup>
                      {availableSymbols.map((symbol) => (
                        <CommandItem
                          key={symbol}
                          onSelect={() => handleSymbolToggle(symbol)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filters.symbols.includes(symbol) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {symbol}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Side */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Side</label>
            <Select value={filters.side} onValueChange={handleSideChange}>
              <SelectTrigger className="flex-1 h-10 bg-background border-border">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-[100]">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trade P&L */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Trade P&L</label>
            <Select value={filters.tradePnL} onValueChange={handleTradePnLChange}>
              <SelectTrigger className="flex-1 h-10 bg-background border-border">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border z-[100]">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="win">Win</SelectItem>
                <SelectItem value="loss">Loss</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Tags */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Tags</label>
            <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 justify-between h-10 bg-background border-border"
                >
                  {selectedTagsCount > 0 ? (
                    <span className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      {selectedTagsCount} selected
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select...</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 bg-popover border-border z-[100]" align="start">
                <CompareGroupFiltersPanel
                  tagsByCategory={filters.tagsByCategory}
                  tradeComments={filters.tradeComments}
                  onTagsChange={handleTagsChange}
                  onCommentsChange={handleCommentsChange}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">Start date</label>
            <div className="flex-1">
              <AppDatePicker
                valueType="date"
                value={filters.startDate}
                onChange={handleStartDateChange}
                placeholder="MM/DD/YY"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground w-20 shrink-0">End date</label>
            <div className="flex-1">
              <AppDatePicker
                valueType="date"
                value={filters.endDate}
                onChange={handleEndDateChange}
                placeholder="MM/DD/YY"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getDefaultCompareGroupFilters = (): CompareGroupFilters => ({
  symbols: [],
  side: 'all',
  tradePnL: 'all',
  tagsByCategory: {},
  tradeComments: {
    entryComments: [],
    tradeManagements: [],
    exitComments: [],
  },
  startDate: undefined,
  endDate: undefined,
});
