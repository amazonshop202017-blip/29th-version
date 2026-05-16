## Plan: View toggle (Card / Table) on Setups page

Add a list/grid view toggle on the Strategies page that mirrors the prop firm Accounts toggle.

### Toggle UI
- Add a `LayoutList` + `LayoutGrid` pair in a `border border-border rounded-lg p-1` container, same active style as `PropFirmAccounts.tsx` (active button = `bg-foreground text-background`).
- Placement: top-right of the "Your Setups" card header (next to the existing "Add Setup" button area), so it controls the view rendered below.

### Behavior
- New state `viewMode: 'card' | 'table'` in `src/pages/Strategies.tsx`, defaulting to `'card'`.
- When `viewMode === 'card'`: render the `SetupCard` grid (already implemented) and HIDE the existing table + mobile card list.
- When `viewMode === 'table'`: render the existing desktop table and existing mobile card list (current behavior), and HIDE the `SetupCard` grid.
- "Setup Overview" heading shown only in card mode; the existing "Your Setups" header in the table card stays.

### Files
- `src/pages/Strategies.tsx` — add state, toggle button group, and conditionally render the two views. No changes to data, no changes to `SetupCard`, `strategyStats.ts`, table internals, or routing.

### Not changing
- Table columns, mobile card layout, add/edit forms, checklist editor, dropdown menu actions, or any other page.
