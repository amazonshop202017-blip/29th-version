# Replace Trade Comments with Per-Category Tag Fields

## Goal

In the Trade Modal's **Advanced** tab, remove the static three-field "Trade Comments" block (Entry Comments / Trade Management / Exit Comments) and replace it with a **dynamic, auto-generated set of fields — one per Custom Category**. Each field lets the user pick/create tags belonging to that category, using the exact same selector logic already inside the "Assign Tags" popup. Categories created in Settings → Custom Tags automatically appear here without any additional wiring.

The standalone "Assign Tags" button/popup in the Trade Modal remains untouched — this just gives users a faster inline way to do the same thing.

## What the user sees

- Open Trade Modal → Advanced tab.
- The "Trade Comments" section is gone.
- A new section "Tags" replaces it.
- For each Category defined in Custom Tags settings, a field is rendered:
  - Label = category name (with its color dot, matching the AssignTagsModal style).
  - Control = the same combobox-style tag picker used in `AssignTagsModal` (search, multi-select with checks, "Create new tag" inline option scoped to that category).
  - Selected tags appear above as removable pills, identical to the modal.
- Selecting/creating tags here writes into the trade's `selectedTags` (the same state that the Assign Tags popup uses), so the two stay in perfect sync — open the popup and the same selections are reflected.
- If no categories exist yet, show a small empty hint: "Create categories in Settings → Custom Tags."

## Technical changes

### 1. Extract the per-category block from `AssignTagsModal`

In `src/components/trades/AssignTagsModal.tsx`, the `CategoryBlock` component already implements exactly the UI we need (header + selected pills + searchable popover + create-new). Refactor it into its own reusable file:

- New file: `src/components/trades/CategoryTagField.tsx`
- Move the `CategoryBlock` JSX/logic there, exported as `CategoryTagField`.
- Props (unchanged from current): `category`, `tags`, `selectedTagIds`, `onToggleTag`, `onCreateTag`.
- Update `AssignTagsModal.tsx` to import and render `CategoryTagField` instead of the local copy. No behavior change in the modal.

### 2. Use the field inside `TradeModal.tsx`

In `src/components/trades/TradeModal.tsx`:

- Remove the entire "Trade Comments Section" block (lines ~1257–1294), including the three `TypeableCombobox` instances for `entryComment`, `tradeManagement`, `exitComment`.
- Keep the underlying state (`entryComment`, `tradeManagement`, `exitComment`) and the save payload fields untouched for now — they simply won't be edited from the UI. (This matches the prior decision to preserve the data model while removing the comments feature.) We can drop `noopAddOption` if it becomes unused.
- In its place, render a new "Tags" section:
  - Pull `categories` from `useCategoriesContext()`.
  - Pull `tags`, `addTag`, `getActiveTags` from `useTagsContext()`.
  - Reuse existing `selectedTags` state (already wired to `AssignTagsModal`) — no new state.
  - Render the section header "Tags".
  - If `categories.length === 0`: show muted hint text.
  - Else: map over `categories` and render `<CategoryTagField />` per category, passing:
    - `selectedTagIds={selectedTags}`
    - `onToggleTag={(id) => setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}`
    - `onCreateTag={(name, categoryId) => { const t = addTag(name, categoryId, ''); if (t) setSelectedTags(prev => [...prev, t.id]); }}`
- Keep the existing standalone "Assign Tags" button/popup as-is — both entry points share the same `selectedTags` state, so changes are mirrored.

### 3. Layout

- Single column of category fields by default (matches the modal's stacked layout, which already works well inside a scrollable form).
- Add a `Separator` above/below to match the surrounding Advanced-tab visual rhythm.

## Files touched

- `src/components/trades/CategoryTagField.tsx` (new — extracted block)
- `src/components/trades/AssignTagsModal.tsx` (use the extracted component)
- `src/components/trades/TradeModal.tsx` (remove Trade Comments block, add Tags section)

## Out of scope

- No changes to `TagsContext`, `CategoriesContext`, Settings → Custom Tags, or the Assign Tags popup behavior.
- The legacy `entryComment` / `tradeManagement` / `exitComment` fields on the Trade type remain in storage but are no longer user-editable. Removing them entirely from the data model is a separate cleanup if you want it later..

important -> make sure when no category of tag is present, we cant show empty, so here add little button to Make Tags, which redirects user to settings page of custom tags 