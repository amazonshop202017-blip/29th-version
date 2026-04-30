## Goal

Bring three behaviors from the reference project ("Trade Data Refiner") into the current Trades page table, with **no logical changes** to data, filters, selection, pagination, deletion, duplication, import/export, column visibility, or category-tag handling. Only the rendering layer of the table changes:

1. **Column sorting** — click any header to toggle asc/desc/none, with visual indicators (`ArrowUp` / `ArrowDown` / `ChevronsUpDown`). Persisted in `localStorage`.
2. **Drag-and-drop column reordering** — drag header to reorder; touch + keyboard supported. Persisted in `localStorage`.
3. **Column resizing** — left + right edge handles on each header; double-click resets; live resize via `columnResizeMode: 'onChange'`. Persisted in `localStorage`.

The first two columns (`select` checkbox and `actions` star/eye/image) stay fixed (non-draggable, non-resizable, non-sortable) — same as the reference.

## Files affected

- `package.json` — add `@tanstack/react-table` and `@dnd-kit/modifiers` (other `@dnd-kit/*` already present).
- `src/components/trades/TradesTableCard.tsx` — replace the inner `<Table>` (currently `TableWithStickyHorizontalScroll`) with a TanStack-driven `<table>` that mirrors the reference's `DraggableTableHeader` / `DragAlongCell` pattern. All existing behavior (action bar, alert dialogs, import modal, tag modal, pagination, category columns, visibility, theming, profit/loss row tinting) is preserved.

No other files change. `useTradesColumnVisibility` keeps its current API and remains the source of truth for which columns are shown.

## Approach

### 1. Build a unified column registry inside `TradesTableCard.tsx`

Define `ColumnDef<Trade>[]` for every existing column: `symbol`, `side`, `volume`, `ticksPips`, `accountName`, `openDateTime`, `closeDateTime`, `duration`, `avgEntry`, `avgExit`, `initialRisk`, `initialTarget`, `strategy`, `strategyChecklist`, `grossPnl`, `netPnl`, `realizedRMultiple`, `plannedRRR`, `fees`, `farthestProfitPrice`, `farthestProfitTicks`, `farthestLossPrice`, `farthestLossTicks`, `postMaxPrice`, `postMaxTickPip`, `postMinPrice`, `postMinTickPip`, `priceReachedFirst`, plus dynamic `category:<id>` columns.

Each `cell` renderer is the exact JSX currently rendered inside the corresponding `isColumnVisible(...)` block (Symbol bold, Side badge with arrows, mono numbers, profit/loss color via `classifyTradeOutcome`, formatted dates via `date-fns`, `maskCurrency`, badge groups for checklist + tags, "+N" overflow, the per-category Plus button that opens the tag modal, etc.).

`accessorFn` is set so sorting works on raw values:
- Date columns sort by `Date.getTime()`.
- Numeric columns sort by the numeric metric (`metrics.netPnl`, `trade.savedRMultiple`, etc.).
- String columns sort alphabetically.
- Columns without a meaningful sort (e.g. `priceReachedFirst`, category tag list, `strategyChecklist`) set `enableSorting: false`.

### 2. Wire visibility into TanStack

Translate `useTradesColumnVisibility`'s `isColumnVisible` map into TanStack's `columnVisibility` state and pass it via `state.columnVisibility`. `toggleColumn` continues to drive it through the existing `TradesColumnSettings` popover — no UX change there.

### 3. Column order (drag-and-drop)

- `DRAGGABLE_COLUMN_IDS` = all data column ids in their initial display order, plus the active `category:<id>` ids appended at the end (same order categories appear today).
- Persist to `localStorage` under `trades-table-column-order`. On load, filter out unknown ids, append any new ones (e.g. newly created categories) so the list stays valid.
- `DndContext` with `MouseSensor` (4px activation), `TouchSensor` (150ms delay, 5px tolerance), `KeyboardSensor`, `closestCenter`, and `restrictToHorizontalAxis` modifier — identical to reference.
- `arrayMove` on drag end.

### 4. Column sizing (resizing)

- `columnResizeMode: 'onChange'`, `defaultColumn: { minSize: 60, maxSize: 600 }`, per-column `size` defaults tuned to current visual widths.
- Two edge resize handles per `DraggableTableHeader` (left + right), styled with the reference's primary-colored thin bar that appears on hover or while resizing.
- `onPointerDown`/`onMouseDown`/`onTouchStart` on the handle stop propagation so resizing never starts a drag, and `onClick` stop-propagation prevents accidental sort.
- Persist sizing to `localStorage` under `trades-table-column-sizing`.
- Use the reference's CSS-variable trick (`--header-{id}-size`, `--col-{id}-size`) recomputed via `useMemo` keyed on `columnSizingInfo` + `columnSizing` + `columnOrder` for buttery resize without rerendering every cell.

### 5. Sorting

- `getSortedRowModel()` enabled. Sorting state persisted under `trades-table-column-sorting`.
- Default sort = `[{ id: 'closeDateTime', desc: true }]` (matches the current `sortedTrades` behavior of newest close-date first).
- The current `useMemo`-based pre-sort is removed; pagination now slices `table.getRowModel().rows` instead of `sortedTrades`. Trade order behavior is unchanged on first load.
- Header click toggles sort only when no drag movement (reference uses `getToggleSortingHandler` inside the same div that has drag listeners — works because dnd-kit's MouseSensor needs a 4px move before activating).

### 6. Preserved logic (unchanged)

- `useFilteredTrades`, `useTradeModal`, `useAccountsContext`, `useGlobalFilters`, `usePrivacyMode`, `useCategoriesContext`, `useTagsContext`, `useTradesContext`, `useStrategiesContext` — all wired exactly as today.
- Action bar: Select All/Deselect, Delete (with `AlertDialog`), Import (`AccountImportModal`), Merge, Duplicate, mobile dropdown, `TradesColumnSettings`, Export CSV — unchanged.
- Pagination controls (per-page select, page select, prev/next) — unchanged.
- Row click opens `TradeModal` via `openModal`.
- Per-row profit/loss tinting via `classifyTradeOutcome` (uses `outcome === 'win'/'loss'` and theme-specific neutral background) — unchanged.
- Sticky header, horizontal scroll, touch scrolling — preserved.
- `framer-motion` wrapper (`motion.div`) and `glass-card` styling — preserved.
- `AssignTagsModal` and `AccountImportModal` — preserved.

### 7. Storage keys

To avoid clashing with the reference project's keys (which only had 11 columns), use namespaced keys:
- `tradesTable.columnOrder.v1`
- `tradesTable.columnSizing.v1`
- `tradesTable.columnSorting.v1`

### 8. Dependencies

Add via `bun add`:
- `@tanstack/react-table`
- `@dnd-kit/modifiers`

## Out of scope

- No change to `useTradesColumnVisibility` signature, group definitions, `TradesColumnSettings` UI, or any other consumer of the table.
- No change to data, calculations, filters, or persistence of trades themselves.
- No change to the action bar buttons, modals, or pagination behavior.
- No styling refactor beyond what's needed to make headers draggable/resizable (hover handles, sort icons).
