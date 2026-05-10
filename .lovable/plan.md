## Backtesting session page — inline trade form + field picker

Rework the session page so trade entry is inline (no Add Trade modal), and the "Add Field" modal becomes a library-style picker where users insert/remove fields (including built-ins) — with their selection persisted per session in localStorage.

### 1. Session page layout (`src/pages/backtesting/BacktestSession.tsx`)

Top → bottom:

1. Header strip (unchanged): back, editable name, Clear / Delete buttons.
2. Stats bar (unchanged).
3. **Toolbar**: only `+ Add Field` button. Remove the `+ Add Trade` button entirely.
4. **Inline trade form** (new): renders directly under the toolbar.
   - Renders an input for every field currently in `fields[]` **except `notes`** (notes stays available in the picker but is hidden from the inline form to keep it compact — matches user's instruction).
   - Same input mapping as before: text → Input, number → number Input, date → AppDatePicker, select → Select.
   - Required fields show `*` and block save when empty.
   - **`+ Save Trade`** button below the fields. On click → appends a `BacktestRow` with the entered values, then resets the form to empty.
5. **Trades table**: unchanged — still lists saved trades with edit/delete row actions. Edit still uses a modal (keeps row-edit UX simple, no scope creep).

Delete `AddTradeModal` from "Add Trade" use; keep it only for the row-edit case (rename usage to edit-only). Or simpler: keep it as-is for editing existing rows; just stop using it for "add".

### 2. Add Field modal becomes a Field Library (`src/components/backtesting/AddFieldModal.tsx`)

Rebuild it to mirror the Dashboard "Add Widget" / Metrics Library popup pattern:

- Title: **Fields Library**.
- Two sections:
  - **Default fields** (built-ins from `DEFAULT_FIELDS`: Date, Symbol, Outcome, R Multiple, Notes). Each row: icon + label + type badge + Insert/Remove button.
    - If the field is currently in `fields[]` → show **Remove** (red).
    - If not → show **Insert** (primary).
    - Mandatory built-ins (`required: true`) can still be removed — per user's instruction, with a subtle "removing this hides win/loss insights" hint under Outcome and date-related ones.
  - **Custom fields** — list of user-added fields with Remove. Below the list: a small `+ Create custom field` button that opens the existing Step-1/Step-2 type picker (Text/Number/Date/Select + label/options/required) we already have, so the create flow stays.
- Selection is persisted via the same `useBacktestSession.persistFields` — `fields[]` is the source of truth and is already saved to `tv-backtest-fields:<accountId>`.

### 3. Built-in re-insertion

When a built-in is removed and later re-inserted, restore the original `FieldDef` from `DEFAULT_FIELDS` (so type/options stay correct). Maintain a stable display order: built-ins keep their canonical order, custom fields appended after.

### 4. Notes handling

`notes` stays a built-in field and remains insertable/removable in the Field Library, but the **inline trade form filters it out** so the entry row stays compact. The trades table still shows the Notes column when present, and Edit-row modal still includes it.

### 5. Files

Edit:
- `src/pages/backtesting/BacktestSession.tsx` — remove Add Trade button, add inline form + Save Trade button, filter `notes` from inline form, keep Edit modal for row edits only.
- `src/components/backtesting/AddFieldModal.tsx` — replace current 2-step flow with Library view (Default + Custom sections, Insert/Remove), nested into a "Create custom field" sub-flow that reuses the existing 2-step picker.

No changes to `backtestStore.ts`, `useBacktestSession.ts`, routing, sidebar, or AccountsContext.

### Out of scope

- Replacing the row-edit modal with inline edit.
- Reordering fields by drag.
- Conditional/required-field rule changes beyond the existing `required` flag.
