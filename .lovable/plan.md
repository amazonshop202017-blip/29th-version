## Canonical field ordering for Backtesting session

### Goal
Fields (and their table columns) always render in a consistent, logical order regardless of the order the user adds them. Related fields stay adjacent: dates together, prices together, risk/target together, P/L stack together, etc.

### Canonical order
A single source-of-truth list lives in `src/lib/backtestStore.ts` as `FIELD_SORT_ORDER`. Any field id not in the list sorts after the listed ones, in insertion order. Category/tag fields (`cat:*`) always go last, sorted alphabetically by label.

```text
1.  date              (Entry Date)
2.  exit_date         (Exit Date)
3.  symbol
4.  direction
5.  setup
6.  quantity
7.  entry_price
8.  exit_price
9.  stop_loss
10. take_profit
11. highest_price
12. lowest_price
13. mfe
14. mae
15. outcome
16. rr                (R Multiple)
17. gross_pnl
18. fees
19. net_pnl
20. break_even
--- category/tag fields (alphabetical) ---
--- any unknown ids (insertion order) ---
```

### Files to change

**`src/lib/backtestStore.ts`**
- Export `FIELD_SORT_ORDER: string[]` with the list above.
- Export `sortFields(fields: FieldDef[]): FieldDef[]` that returns a new array sorted by:
  1. index in `FIELD_SORT_ORDER` (lower first)
  2. category fields (`cat:` prefix) grouped after, alphabetical by `label`
  3. anything else, original relative order preserved (stable sort)

**`src/hooks/useBacktestSession.ts`**
- After `loadFields`, run `sortFields` on the result before setting state.
- In `addField`, sort the merged list before persisting.
- In `removeField`, sort is preserved automatically (filter keeps order).
- `persistFields` itself doesn't need to sort (callers handle it), but adding a sort there is a safe belt-and-suspenders move.

**`src/pages/backtesting/BacktestSession.tsx`**
- `entryFields` already comes from `fields`; no change needed once the hook sorts.
- `derivedColumnIds` already runs through `fieldLabelFromCatalog`; sort it with the same comparator so auto columns also follow canonical order.
- The trades table renders configured fields followed by derived columns — keep that split (configured first, auto columns after), each block individually sorted.

**`src/components/backtesting/AddTradeModal.tsx`**
- No change. It receives `fields` already in the sorted order from the parent.

**`src/components/backtesting/AddFieldModal.tsx`**
- No change. The Add Field library is grouped by General / Advance / Tags using existing catalog arrays, which are already in a sensible order.

### Behavior on enable/disable
- When a field is auto-removed by derivation, the remaining fields keep canonical order (filtering is stable).
- When the user re-adds an auto-removed field, it slots back into its canonical position — never appended at the end.
- When the user adds any new field via Add Field, it slots into its canonical position immediately.

### Out of scope
- No changes to the global Add Trade modal or any non-backtesting page.
- No user-facing custom reordering / drag-to-reorder. (Can be a future enhancement.)
- Existing saved sessions: their `fields` array gets re-sorted on next load, which only affects display order, not data.