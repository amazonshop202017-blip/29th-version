## Goal

Make widget drag-and-drop on the Dashboard feel smooth and predictable, fix the oversized drag preview, ensure widgets can be dropped into visually empty grid cells, and surface "click to add" placeholders in those empty cells while in edit mode.

## Problems observed

1. While dragging, the picked-up KPI/widget visually balloons (~5x) — caused by the sortable item using `CSS.Transform.toString(transform)` which combines translate with scaling on some browsers, plus no overlay being used. Dragged element also takes its grid cell sizing with it.
2. Empty grid cells (where `col-span-2` widgets leave a gap, or when item count doesn't fill a row) cannot be dropped onto because no sortable target exists there.
3. No way to click an empty grid gap to add a new widget while in edit mode.
4. Drop animation/transition is jumpy: PointerSensor distance is 8px (fine) but no `DragOverlay` is used, so the original item stays in place and re-renders with `transform` causing the snap.

## Plan

### 1. Introduce a `DragOverlay` for both grids
Files: `src/pages/Dashboard.tsx`, `src/components/dashboard/DashboardMetrics.tsx`

- Track `activeId` via `onDragStart` / `onDragEnd` / `onDragCancel`.
- Wrap the grid in `<DragOverlay>` rendering a "ghost" copy of the dragged widget at its natural size (clamped to a max width so a `col-span-2` chart doesn't render huge — use the original cell's measured width via a ref map, or a sensible max like `w-[420px]`).
- In `SortableMetric` / `DraggableChartWrapper`, hide the original (`opacity-0`) while it's the active item, so only the overlay is visible.
- Use `CSS.Translate.toString(transform)` (translate-only) instead of `CSS.Transform.toString(transform)` on the sortable items themselves to stop accidental scaling on neighbors during reflow.

### 2. Smoother sortable transitions
- Pass an explicit `transition` from `useSortable` (already provided) but add `animateLayoutChanges: () => true` and `transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }` to each `useSortable` call so neighbors slide smoothly.
- Keep `PointerSensor` distance at 8 and `TouchSensor` delay/tolerance as-is.
- Use `rectSwappingStrategy` or keep `rectSortingStrategy` for charts (current) but switch metrics from `horizontalListSortingStrategy` to `rectSortingStrategy` so multi-row metric grids reorder correctly.

### 3. Fillable empty cells in the charts grid
File: `src/pages/Dashboard.tsx`

The chart grid uses 3 columns with mixed `col-span` (1 or 2). When the running column total leaves a 1-col gap at row end, that gap is unreachable.

- Compute "trailing gap slots" after the last widget based on the running col sum (mod 3 on lg, mod 2 on md).
- In edit mode, render one `AddWidgetPlaceholder` per gap slot (already partially done with two hard-coded placeholders — replace with the computed count, capped so they don't push past one extra row).
- Outside edit mode, render nothing for empty gaps (current behavior).

To allow dropping into those gaps, register the gap as a droppable using `useDroppable` with id `__gap_<index>__`; in `onDragEnd`, if `over.id` starts with `__gap_`, insert the active item at the position derived from the gap index (append to end or place before the next chart that would land there).

### 4. Fillable empty cells in the metrics grid
File: `src/components/dashboard/DashboardMetrics.tsx`

- The metrics row already adds a single Add placeholder when `metricsOrder.length < MAX_METRICS` and applies a span class to the trailing odd item. Extend so when in edit mode and the count is odd at the current breakpoint, the Add placeholder fills the remaining slot rather than spanning full width.
- No additional droppable needed — the existing Add tile already sits in the flow.

### 5. Visual polish for the drag ghost
- Overlay item uses `glass-card` styling + slight `shadow-2xl` + `scale-[1.02]` (deliberate small lift) and the same border-radius. This replaces the current accidental 5x balloon with a tasteful lift.
- Add `cursor: grabbing` on `<body>` while dragging via a `useEffect` toggling a class on document body in `onDragStart` / `onDragEnd`.

## Technical notes

- `DragOverlay` must be rendered inside `<DndContext>` but outside `<SortableContext>`.
- To measure original cell size for the overlay, store refs per id in a `Map<string, HTMLElement>` and read `getBoundingClientRect()` on drag start; pass width to overlay style.
- Keep all logic client-side; no schema/data changes.
- No new dependencies — `@dnd-kit/core` already exports `DragOverlay`, `useDroppable`, and `CSS.Translate`.

## Files to change

- `src/pages/Dashboard.tsx` — DragOverlay, activeId state, gap droppables + AddWidgetPlaceholders, drop handler updates.
- `src/components/dashboard/DraggableChartWrapper.tsx` — switch to translate-only transform, hide original when active, add layout-change transition.
- `src/components/dashboard/DashboardMetrics.tsx` — same overlay/active-hide treatment, switch sorting strategy, drop handler tweaks.
- `src/components/dashboard/AddWidgetPlaceholder.tsx` — accept optional `size="sm"` variant so gap placeholders match KPI height.

## Out of scope

- Backend/data, KPI computation, chart visuals, mobile-specific changes beyond what existing TouchSensor already covers.
