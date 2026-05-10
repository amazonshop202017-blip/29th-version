## Auto-derivation of fields in Backtesting session

### Goals
1. `Direction` is part of the default fields (on by default for new sessions).
2. When a field can be computed from other selected fields, it is removed (deselected) from the session's configured fields, and its value is auto-calculated and stored on each saved trade. The user can re-add the field via Add Field if they want to enter it manually again.

### Derivation rules
The system applies these rules in order whenever fields change or a row is saved:

| Derived field | Required source fields | Formula |
|---|---|---|
| `rr` (R Multiple) | `entry_price`, `exit_price`, `stop_loss`, `direction` | `(exit - entry) * dirSign / abs(entry - stop)` |
| `rr` (fallback) | `entry_price`, `exit_price` | `exit - entry` (signed, long-assumed) |
| `outcome` | `entry_price`, `exit_price`, `direction` | sign of `(exit - entry) * dirSign` → `Win` / `Loss` / `BE` |
| `gross_pnl` | `entry_price`, `exit_price`, `quantity` (+ optional `direction`) | `(exit - entry) * qty * dirSign` |
| `net_pnl` | `gross_pnl` (or sources for it) + `fees` | `gross_pnl - fees` |

`dirSign = direction === 'Short' ? -1 : 1`. If `direction` not configured, assumed `Long`.

### Files to change

**`src/lib/backtestStore.ts`**
- Add `direction` to `DEFAULT_FIELDS` (after `symbol`, before `outcome`).
- Add `DERIVATION_RULES`: array of `{ derivedId, sources: string[], compute(values) => value }`.
- Export helpers:
  - `getDerivedFieldIds(fieldIds: string[]): string[]` — returns ids that should be auto-removed because all their sources are present in `fieldIds`.
  - `applyDerivations(fieldIds: string[], values: Record<string, any>): Record<string, any>` — returns values with derived entries filled in.

**`src/hooks/useBacktestSession.ts`**
- After `addField`, run `getDerivedFieldIds` against the new field list and strip any fields that are now derivable; persist the cleaned list.
- In `addRow` and `updateRow`, run `applyDerivations` so derived values are stored on the row even when the field isn't in `fields`.

**`src/pages/backtesting/BacktestSession.tsx`**
- Inline form: render only `fields` (already does). Derived fields are not shown because they were removed from the list.
- Trades table: include columns for any derived ids that have stored values on at least one row, in addition to the configured `fields`. Header label comes from `FIELD_CATALOG`. This way the user can see auto-calculated `rr`/`outcome`/etc. even though the input is hidden.
- `formatVal` unchanged.

**`src/components/backtesting/AddTradeModal.tsx`** (edit-trade modal)
- After save, also run `applyDerivations` on the submitted values so edits keep derived columns up to date.

### UX details
- A field that gets auto-removed shows a brief toast: `"R Multiple is now auto-calculated from Entry/Exit Price."`
- In `AddFieldModal`, fields whose sources are already selected appear as normal "Insert" chips. If the user re-inserts a derived field (e.g. `rr`), it goes back into `fields` and the auto-calc step skips it (manual entry takes precedence). Re-adding is the user's escape hatch, exactly as requested.
- If the user later removes a source field (e.g. removes `exit_price`), nothing is force-restored; the derived field can be re-added manually.

### Out of scope
- No changes to the global Add Trade modal or any non-backtesting page.
- No new derivation rules beyond the table above.
- No retro-fill of derivations on existing rows when fields change (only on save/edit going forward).