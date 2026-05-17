## Goal

Replace the current "flow-pack" chart grid with a true cell-based layout so every empty slot shows a "Click to add widget" button, widgets can be dropped into any specific cell, and users can intentionally leave empty cells without the layout collapsing.

## Why the current layout fails

Today the chart grid is a CSS flow grid: widgets are rendered in order with `col-span` 1 or 2 and the browser auto-packs them. When a 2-col widget follows a 1-col widget on a 3-col row, a 1-col gap appears at row end — and that gap is **unreachable** because no droppable lives there. Trailing "+ Add" tiles only land at the very end of the flow, never inside earlier gaps. There is no way for a user to say "put this chart in row 3, column 2".

## New model: positioned grid

### Data shape
Each chart entry becomes `{ id, row, col, colSpan, rowSpan }` instead of just an id string. Stored as `dashboardChartLayout` in user preferences (keep `dashboardChartOrder` as a fallback migrator — on first load with the old format, convert it by greedy-packing into the new grid, then save).

### Grid rendering
- Fixed column count per breakpoint: 1 (mobile), 2 (md), 3 (lg). Position uses lg as canonical; on smaller breakpoints we re-flow by sorting (row, col) and clamping `colSpan` to fit.
- Compute total rows = `max(row + rowSpan)` for placed widgets, then add **one trailing empty row** while in edit mode (so users always have somewhere to extend).
- Build a `Set<"row,col">` of occupied cells. For every cell in the grid that is NOT occupied, render an `AddWidgetPlaceholder` wrapped in a `useDroppable` keyed by `cell:<row>,<col>` — this is what fixes the screenshot's blank area.
- Outside edit mode: hide empty cells entirely (use `grid-auto-rows` + explicit placement so empty cells just leave whitespace, matching today's visual when full).

### Drag behavior
- Dragging a widget onto an empty cell `cell:r,c`: update that widget's `{row, col}` to `(r, c)`. If its `colSpan` would overflow the row, clamp it (or refuse the drop if the destination cell is occupied by another widget's span).
- Dragging onto an occupied cell that belongs to another widget: swap their positions (preserve each widget's own span).
- Use `DragOverlay` already added in the previous step; keep the smooth translate-only transforms.
- Collision detection: switch from `closestCenter` to `pointerWithin` so the cell directly under the pointer wins — important for landing in a specific empty slot.

### Adding widgets
- Clicking any empty-cell placeholder opens the existing `ChartLibraryModal`, but remembers the clicked cell. When the user picks a chart, it is inserted at that cell (instead of being appended).
- Removing a widget leaves its cell(s) empty (no auto-compaction), which is exactly the behavior the user asked for.

### Resize (optional, scoped out unless requested)
Keeping current `colSpan`/`rowSpan` defaults from `CHART_CONFIGS`. A future pass can add drag-handles on edges to resize; not part of this plan.

## Responsive behavior

- **lg (≥1024px):** 3-column positioned grid as described.
- **md (768–1023px):** 2-column grid. Map each widget's `col` to `col % 2`, sort by `(row, col)`, render in order using `col-span` clamped to 2.
- **mobile (<768px):** single column, sorted by `(row, col)`, all widgets full width.

Empty-cell placeholders only render at lg (where positioning is meaningful). At md/mobile, the trailing "+ add" tile already covers the "I want more widgets" case.

## Migration

On first render after this change:
1. Read `prefs.dashboardChartLayout`. If present and valid, use it.
2. Else read legacy `prefs.dashboardChartOrder`, greedy-pack into 3-col rows respecting each widget's `colSpan`/`rowSpan`, write the result back as `dashboardChartLayout`.
3. Default layout for brand-new users derived from `DEFAULT_CHART_ORDER` the same way.

## Files to change

- `src/pages/Dashboard.tsx` — replace flow grid with positioned grid, add empty-cell droppables, swap collision strategy, plumb "clicked cell" through to `ChartLibraryModal`.
- `src/components/dashboard/DraggableChartWrapper.tsx` — accept explicit `gridColumn`/`gridRow` style instead of `col-span` classes (keeps positioning exact).
- `src/components/dashboard/AddWidgetPlaceholder.tsx` — already supports `size`; no change beyond passing through.
- `src/contexts/AuthContext.tsx` (only the preferences type) — add `dashboardChartLayout?: Array<{id; row; col; colSpan; rowSpan}>`. Keep `dashboardChartOrder` for migration.

## Out of scope

- Metric KPI strip (top row) — keeps its current responsive grid; user only complained about the charts area in the screenshot.
- Edge-drag resize handles.
- Any backend/data changes; this is purely a frontend layout refactor.

## Technical notes

- Use CSS `grid-template-columns: repeat(3, minmax(0, 1fr))` and explicit `style={{ gridColumn: \`${col + 1} / span ${colSpan}\`, gridRow: \`${row + 1} / span ${rowSpan}\` }}` on each wrapper. This makes empty cells truly reachable because the grid no longer auto-packs.
- `useDroppable` from `@dnd-kit/core` is already imported; reuse the existing `GapDroppable` pattern.
- Swap logic: when `over.id` matches another widget's id, set `active.row,col = over.row,col` and vice versa.
- Validate destination on drop: if the dragged widget's span would overlap a different widget at the target, fall back to swapping with the topmost-leftmost conflicting widget.
