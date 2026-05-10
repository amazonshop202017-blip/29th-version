# Plan: Tag Categories in Backtesting Field Library

## Goal
Under the "Advance" section in the Add Field modal, add a third box titled **Tags** that lists every user-defined category (from `CategoriesContext`) as a chip — same toggle UX as other fields. Inserting a category chip adds a corresponding "select" field for that category to the session form. When saving a trade, the user can pick a tag from that category's options, mirroring how the global `+ Add Trade` modal handles tags.

This whole page exists only to let backtesting users prune the trade form down to what they need — fewer inputs, faster entry. No business logic changes elsewhere.

## Changes

### 1. `src/lib/backtestStore.ts`
- Define a stable id format for category fields: `cat:<categoryId>`.
- Export a small helper `buildCategoryField(category, tagsInCategory)` that returns a `FieldDef`:
  - `id: \`cat:${category.id}\``
  - `label: category.name`
  - `type: 'select'`
  - `options: tagsInCategory.map(t => t.name)`
  - `builtin: false` (user-controlled, removable)
- No change to `DEFAULT_FIELDS`; tags start unselected.
- When `loadFields` returns persisted fields, category-typed entries (`id` starting with `cat:`) keep working as plain select fields.

### 2. `src/components/backtesting/AddFieldModal.tsx`
- Accept `categories` and `tags` via props (or read directly from `useCategoriesContext` / `useTagsContext`).
- Add a third category box rendered after Advance:
  - Title: **Tags**
  - Color dot: use each category's own color for that chip border/background tint, OR a single accent for the section header (keep the section header dot consistent — e.g. `--chart-4`).
  - Body: flex-wrap chips, one per user category. Active state = a `cat:<id>` field already exists in `fields`.
  - Clicking a chip calls `onInsert(buildCategoryField(category, tagsForCategory))` or `onRemove('cat:'+category.id)`.
- If there are zero categories, show a muted line: "No categories yet. Create them in Settings → Tags."
- Keep ordering: General → Advance → Tags.

### 3. `src/pages/backtesting/BacktestSession.tsx`
- No structural change needed. The existing `FieldInput` already renders `select` fields with `options`. Category fields will appear automatically in the inline form and as table columns.
- Saved row values for `cat:<id>` are simple strings (the chosen tag name), so the existing `formatVal` works.
- Optional polish: when rendering a category field's label in the form, prefix with a small colored dot (`category.color`) for parity with the Add Trade popup. This is presentational only.

### 4. Persistence
- Reuse the existing `tv-backtest-fields:<accountId>` localStorage key. Category fields persist as normal `FieldDef` objects.
- If a category is later renamed/deleted globally, the stored field keeps its label/options snapshot until the user reopens the modal — at that point we refresh `options` from current tags before insert. (No background sync to keep scope small.)

## Out of scope
- Creating/editing categories or tags from this modal.
- Multi-tag-per-category selection (kept as single-select for speed, matching the simpler intent).
- Any changes to the global Add Trade modal or other pages.
