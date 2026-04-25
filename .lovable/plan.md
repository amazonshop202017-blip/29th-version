# Per-Category Tag Columns in Trades Table

Add a new dynamic section to the Trades table column settings called **Custom Tag Categories**. Each user-created category becomes its own column in the trades table, displaying only the tags from that category assigned to each trade — using the same bubbled badge design used in the Day View trades table.

## What the user will see

**Column Settings panel (Trades page → ⚙️):**

- Existing groups (Trade Identification, Timing, Execution & Plan, Performance, Price Movement) stay unchanged.
- A new last section **Custom Tag Categories** lists every category from Settings → Categories. Each row is a checkbox toggling that category's column.
- If no categories exist yet, the section shows a small muted helper line: "Create categories in Settings → Tags to enable per-category columns."
- All category columns default to **off** (so existing users see no change until they opt-in).

**Trades table:**

- For each enabled category, a new column appears at the right end of the table (after Price Movement columns), header = category name.
- Each cell shows the trade's assigned tags **belonging to that category only**, rendered as outline badges (same style as Day View):
  - Show up to 2 badges, then `+N` muted text for overflow.
  - A small `+` icon button opens the existing `AssignTagsModal` for that trade (same behaviour as Day View).
  - Empty cell shows `–`.
- Clicking the row still opens the trade modal; the `+` button stops propagation.

## Technical details

**1. `src/hooks/useTradesColumnVisibility.ts**`

- Keep `ALL_COLUMNS` and `COLUMN_GROUPS` for static columns unchanged.
- Add a new exported helper `buildCategoryColumns(categories)` that returns one `ColumnConfig` per category with id `category:<categoryId>`, group `tagCategories`, default `visible: false`.
- Update the hook to accept categories and merge static + dynamic columns. Persist visibility under existing `STORAGE_KEY` keyed by id (works automatically because ids are stable).
- Add a `tagCategories` group to a new returned `columnGroups` array (only included when there's ≥1 category) with label "Custom Tag Categories".
- Prune visibility entries for deleted categories on load (defensive).

**2. `src/components/trades/TradesColumnSettings.tsx**`

- No structural change needed — it already iterates `columnGroups` and renders each. The new dynamic group will render automatically.
- Add an inline empty-state message inside the section if the group exists but has 0 columns (handled by passing the group with empty columns or by skipping render — we'll skip and show no section if no categories).

**3. `src/components/trades/TradesTableCard.tsx**`

- Read `categories` from `useCategoriesContext` and `tags` from `useTagsContext`.
- Pass `categories` into `useTradesColumnVisibility(categories)`.
- In `TableWithStickyHorizontalScroll`:
  - Accept `categoryColumns` (list of `{id, categoryId, name}` for visible category columns) and the `tags` list.
  - Append one `<TableHead>` per visible category column at the end of the header row.
  - For each row, append one `<TableCell>` per visible category column rendering badges for `trade.tags` filtered to `tag.categoryId === categoryId`. Reuse the same JSX block as `DayTradesTable` (outline Badge, `+N` overflow, `Plus` icon button).
- Wire the `+` button to open `AssignTagsModal` (already imported pattern from Day View) — add modal state at the card level and call `updateTrade` on save.

**4. Reuse**

- `AssignTagsModal` is already used by `DayTradesTable.tsx` — import and reuse it identically.
- `Badge` styling: `variant="outline"` with `className="text-xs"`, identical to Day View.

## Files to edit

- `src/hooks/useTradesColumnVisibility.ts`
- `src/components/trades/TradesTableCard.tsx`

## Files unchanged but read

- `src/components/trades/TradesColumnSettings.tsx` (works as-is once the hook returns the new group)
- `src/contexts/CategoriesContext.tsx`, `src/contexts/TagsContext.tsx` (data sources)
- `src/components/dayview/DayTradesTable.tsx` (reference for badge design)

make sure it doesnt affect the current logics. only adds the logic of categories as column and values of tags assigned of that category to each trade.