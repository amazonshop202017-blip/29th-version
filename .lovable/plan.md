## Goal

Inside the Advanced Filters popover, add a new left-menu entry **Basic Filters**. The right pane lists every basic filter as a checkbox row. Checking a row reveals that filter's input control (the same multi-select / picker already used in the current Basic Filters dropdown). Unchecking clears its value and hides the input. Visual language matches the existing General / Tags sections.

The current Basic Filters dropdown button in the header stays in place. We will remove it only after you confirm the replication works.

## Where

Single file: `src/components/layout/AdvancedFiltersPanel.tsx`

No changes to `GlobalFiltersContext` (all state already exists), no changes to `GlobalHeader.tsx` other than implicitly through the panel it renders.

## Left menu — new entry

Add to the `menuItems` array (above Tags):

```
{ key: 'basic', label: 'Basic Filters', icon: <Filter className="w-4 h-4" /> }
```

`MenuSection` type extended to `'basic' | 'general' | 'tags'`. Default `activeSection` becomes `'basic'`.

## Right pane — "Basic Filters" section

A vertical list of rows. Each row has a checkbox + label; when checked, an indented input control renders below it (matching the `ml-6` indent already used for tag selectors).

Rows and the input they reveal:

| Filter | Checked when | Input shown on expand |
|---|---|---|
| Symbol | `selectedSymbols.length > 0` | Combobox popover with search + multi-select of `availableSymbols` |
| Setup | `selectedSetups.length > 0` | Combobox popover with multi-select of strategies |
| Checklist of Setup | `selectedChecklistItems.length > 0` | Combobox popover of checklist items (disabled until Setup chosen) |
| Outcome | `selectedOutcomes.length > 0` | Combobox multi-select of OUTCOME_OPTIONS |
| Direction | `selectedDirections.length > 0` | Combobox multi-select of DIRECTION_OPTIONS |
| Day of Week | `selectedDays.length > 0` | Combobox multi-select of DAY_OPTIONS |
| Hour | `selectedHours.length > 0` | Combobox multi-select of 0–23 |
| Last Trades | `lastTradesFilter !== null` | Single-select dropdown of LAST_TRADES_OPTIONS |
| Year | `selectedYear !== null` | Year picker (same grid used today) |
| Return % | `selectedReturnRanges.length > 0` | Combobox multi-select of ReturnPercentRange |
| R-Multiple | `selectedRMultipleRanges.length > 0` | Combobox multi-select of RMultipleRange |

Behavior rules (mirroring existing Tags/Comments rows):

- Clicking the checkbox or label toggles the row.
- Checking a row that is currently empty just expands it (no auto-select-all, since most of these have no natural "all" preset).
- Unchecking clears that filter's state via its existing setter (`setSelectedSymbols([])`, etc.) and collapses the row.
- A row whose state is non-empty is always rendered expanded (treat non-empty state as implicit "checked + expanded"), matching how Tags behaves.

Pull state and setters from `useGlobalFilters()` — already exposed.

## Visual / styling

- Reuse existing classes from this panel: `space-y-2` between rows, `ml-6` indent for the revealed input, `bg-background border-border h-9 text-sm` for combobox triggers.
- Use the same `Popover + Command + CommandInput + CommandList + CommandGroup + CommandItem` pattern already in the file for the Tags/Comments multi-selects, with a small checkbox glyph on each item.
- Single-value pickers (Last Trades, Year) use a plain `Popover` with simple options list, no `Command` search.
- Icons next to each label (`Globe`, `BarChart2`, `ListFilter`, `TrendingUp`, `Clock`, `Hash`, `CalendarIcon2`, `Percent`) for parity with the header dropdown.

## What we keep / don't touch

- Legacy Basic Filters dropdown button + its big grid popover in `GlobalHeader.tsx` — untouched.
- `activeBasicFiltersCount` / `hasActiveTagFilters` counters — untouched.
- Mobile sheet wiring — untouched.

## Out of scope (this round)

- Removing the legacy Basic Filters button.
- Moving Date Range / Account into the panel.
- Refactoring the giant grid popover in `GlobalHeader.tsx`.

Once you confirm the new section behaves correctly, follow-up step will delete the legacy basic-filters trigger + grid and route mobile "Basic Filters" sheet to open the Advanced panel on the new section.
