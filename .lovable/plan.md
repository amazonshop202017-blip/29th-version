## Add "Position Size" Filter (Min/Max qty)

Mirror the R-Multiple Min/Max pattern across the same 5 files. Position size = `calculateTradeMetrics(trade).totalQuantity`. Supports decimals, inclusive bounds, both empty = all.

### 1. `src/contexts/GlobalFiltersContext.tsx`
- Add state: `positionSizeMin: number | null`, `positionSizeMax: number | null` with setters.
- Expose in context type, value, and `useMemo` deps. Include in `resetAllFilters`.

### 2. `src/contexts/TradesContext.tsx`
- Pull `positionSizeMin`, `positionSizeMax` from context.
- After R-Multiple block, add: if either is non-null, compute `qty = calculateTradeMetrics(trade).totalQuantity`, drop trade if `min !== null && qty < min` or `max !== null && qty > max`.
- Add both to `useMemo` deps.

### 3. `src/hooks/useAccountScopedFilteredTrades.ts`
- Same filter logic and deps as TradesContext.

### 4. `src/components/layout/AdvancedBasicFiltersSection.tsx`
- Pull `positionSizeMin/Max` + setters.
- Add a new `FilterRow` titled "Position Size" with the same two Min/Max `Input` fields (type=number, step=any to allow decimals like 0.5), placed right after the R-Multiple row.
- `active` = either non-null; toggling off clears both.

### 5. `src/components/layout/GlobalHeader.tsx`
- Add the same Min/Max inputs to the header filters popover, right after R-Multiple.
- Include in active filter count and `useMemo` deps.

### 6. `src/components/layout/SelectedFiltersBar.tsx`
- Add a chip: `"{min ?? '−∞'} to {max ?? '+∞'} qty"` when either bound set. `onRemove` clears both.
- Include setters in `clearAll` and both values in deps.

### Notes
- Inputs accept decimals (`step="any"`) and reject negative values via `min="0"`.
- Empty string → `null` (unbounded on that side).
- No backend/schema changes.
