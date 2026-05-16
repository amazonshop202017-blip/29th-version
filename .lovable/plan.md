# Add Setup "Excluding" Filter

Mirror the existing Setup (include) multi-select with a second "Excluding" multi-select directly beneath it. Trades whose `strategyId` matches any excluded setup are removed from results.

## Scope

- Applies to the global Strategy filter only (Setup). Checklist items are unchanged for now.
- "Include" semantics unchanged: if non-empty, only trades with one of those setups pass.
- "Exclude" semantics: if non-empty, trades with any of those setups are removed (applied after include).

## Files to change

### 1. `src/contexts/GlobalFiltersContext.tsx`

- Add state `excludedSetups: string[]` + `setExcludedSetups`.
- Add to context type, provider value, `useMemo` deps, and `resetAllFilters`.

### 2. `src/contexts/TradesContext.tsx`

- After the existing `selectedSetups` include filter, add:
  ```
  if (excludedSetups.length > 0) {
    filtered = filtered.filter(t => !t.strategyId || !excludedSetups.includes(t.strategyId));
  }
  ```
- Add to `useMemo` deps.

### 3. `src/hooks/useAccountScopedFilteredTrades.ts`

- Same exclude filter as above; add to deps array.

### 4. `src/components/layout/AdvancedStrategySection.tsx`

- Pull `excludedSetups`, `setExcludedSetups` from context.
- Under the existing Setup `FilterRow`, when Setup row is expanded/active, render a second labeled block "Excluding" with a `CheckboxMultiSelect` bound to `excludedSetups`. Match the reference screenshot styling (small label above the dropdown, placeholder "Exclude").
- Treat the row as `active` if either include or exclude has selections; toggling off clears both.

### 5. `src/components/layout/GlobalHeader.tsx`

- Add `excludedSetups`/`setExcludedSetups` to the header filter popover (same place Setup currently lives), as a second select labeled "Excluding".
- Include in `useMemo`/`useEffect` deps.

### 6. `src/components/layout/SelectedFiltersBar.tsx`

- Add an "Excluding setups: N" chip when `excludedSetups.length > 0`, with `onRemove` clearing `excludedSetups`. Include in `clearAll`.

## Notes

- No backend / schema changes.
- Pure frontend, follows the established R-Multiple / Position Size pattern.

make sure to match the design, as it have similar menu tree line like we have in tools menu in sidebar