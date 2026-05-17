## Goal

Eliminate the visible holes in the dashboard chart grid (visible in the screenshot next to the calendar, beside Trade Duration Performance, etc.) without forcing the user into edit mode.

## Approach

Two small, focused changes to `src/pages/Dashboard.tsx` (chart grid only — KPI metrics row is untouched per your choice):

### 1. Auto-reflow: pack widgets densely

The grid currently uses `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. Mid-grid holes appear when a `colSpan: 2` widget is followed by another `colSpan: 2` (the leftover 1-col slot stays empty), or when a `colSpan: 1` widget sits next to a `colSpan: 2` near a row break.

Fix: add Tailwind's dense auto-flow so CSS automatically backfills earlier 1-col holes with later 1-col widgets:

```
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-flow-row-dense gap-3 md:gap-2
```

This is a pure layout change — widget order in state is preserved, only the visual placement shifts smaller cards up into open slots. No drag-and-drop logic changes.

### 2. Always-visible "+ Add widget" tile at the end

Today the `AddWidgetPlaceholder` tiles only render when `isEditMode` is true. Change the trailing-slot logic so:

- **Normal mode**: render exactly **one** `AddWidgetPlaceholder` (colSpan 1) after the last widget. Clicking it opens the existing `ChartLibraryModal` (`setIsLibraryOpen(true)`), same as the edit-mode tile.
- **Edit mode**: keep current behavior — render the wider set of `GapDroppable` placeholders (`Math.max(lgGapCount, 2)`) so drag-and-drop targets remain generous.

The trailing tile in normal mode uses a lighter visual treatment (dashed border, muted icon + label) so it reads as an invitation rather than a widget. In edit mode the existing stronger styling stays.

### 3. Hide the trailing tile when the library is exhausted

If every chart in `CHART_CONFIGS` is already in `chartOrder`, skip rendering the "+ Add widget" tile (nothing left to add).

## Files to change

- `src/pages/Dashboard.tsx` — add `grid-flow-row-dense`, adjust placeholder rendering branch for normal vs edit mode, add "all widgets added" guard.
- `src/components/dashboard/AddWidgetPlaceholder.tsx` — accept a `variant?: 'subtle' | 'edit'` prop so the normal-mode tile is visually quieter than the edit-mode one.

## Out of scope

- KPI metrics grid (`DashboardMetrics.tsx`) — left as-is per your answer.
- Backend, data, chart internals, drag-and-drop mechanics from the previous plan.
- Reordering widgets to "prefer" certain layouts — we only let CSS dense flow fill obvious holes.

## Result

A user landing on the dashboard sees a tightly packed chart grid with no empty cells, plus a single subtle "+ Add widget" tile at the end they can click to add more — no edit mode required.
