## Replace R-Multiple preset ranges with Min/Max inputs

Switch the R-Multiple filter from a multi-select of hard-coded ranges (`< -2R`, `-2R to 0R`, …) to a custom range driven by two number inputs: **Min** and **Max**. Either can be left blank to mean "no bound on that side". A trade matches when `savedRMultiple >= min` (if min set) AND `savedRMultiple <= max` (if max set).

### Files to change

1. **`src/contexts/GlobalFiltersContext.tsx`**
   - Remove `RMultipleRange` type and `selectedRMultipleRanges` / `setSelectedRMultipleRanges` state from context (type + state + context value + deps).
   - Add new state:
     - `rMultipleMin: number | null`, `setRMultipleMin`
     - `rMultipleMax: number | null`, `setRMultipleMax`
   - Expose both via context value and include in the `useMemo` deps.

2. **`src/contexts/TradesContext.tsx`**
   - Remove the `selectedRMultipleRanges` import/usage and the existing range-based filter block (and the `matchesRMultipleRange` helper if unused elsewhere — verify first).
   - Add a new filter: when `rMultipleMin !== null` or `rMultipleMax !== null`, keep trades where `savedRMultiple` is defined and within bounds.
   - Update the `useMemo` deps accordingly.

3. **`src/components/layout/AdvancedBasicFiltersSection.tsx`**
   - Remove `R_MULTIPLE_OPTIONS` constant, `RMultipleRange` import.
   - Replace the R-Multiple `FilterRow` body with two side-by-side `Input` fields (type=number, placeholders **Min** / **Max**) bound to `rMultipleMin` / `rMultipleMax`. Empty string → `null`.
   - `active` is true when either bound is set; toggling off clears both.

4. **`src/components/layout/SelectedFiltersBar.tsx`**
   - Remove `RMultipleRange`, `R_MULTIPLE_LABELS`, and per-range chip loop.
   - Add a single chip rendered when min and/or max is set, displayed as `"{min ?? '−∞'} to {max ?? '+∞'} R"`; its `onRemove` clears both bounds. Also include both setters in the `clearAll` reset.

### Notes
- Inputs accept decimals and negatives (e.g., `-2`, `1.5`). Use `Input` with `type="number"` and `step="0.1"`.
- Comparison is inclusive on both bounds, matching how `'-2-0'` historically meant `-2 ≤ R ≤ 0`.
- No backend/database changes — purely client-side filter logic and UI.
