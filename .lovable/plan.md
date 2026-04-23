

## Fix Hover Text Color on Filter Menu Items

### Problem

In **light mode**, `--accent` is dark navy (`#26303d`) and `--accent-foreground` is white. Many menu items use `hover:bg-accent` **without** `hover:text-accent-foreground`, so on hover the row turns dark while the text/icon stays dark → **black text on black background, invisible**.

The same pattern exists in 16 files across the app. This plan fixes them everywhere.

### Affected areas (confirmed)

1. **Currency / Display Mode menu** (`DisplayModeSelector.tsx`) — Dollar / Percentage / Privacy / Tick rows.
2. **Date Range popover** (`GlobalHeader.tsx`):
   - Right-side preset list: All time, Today, This week, This month, Last 30 days, Last month, This quarter, YTD.
3. **Date Range Calendar dropdowns** (`DateRangeCalendar.tsx`):
   - Month dropdown items (January … December)
   - Year dropdown items (2015 … 2035)
   - Month/year trigger buttons themselves (use `hover:bg-accent`)
4. **Basic Filters popover rows** (`GlobalHeader.tsx`): Symbol, Setup, Checklist, Outcome, Direction, Day, Hour, Return %, R-Multiple, Year picker grid cells.
5. **Other components flagged by the same pattern** — sweep via search across all 16 files (e.g. AdvancedFiltersPanel, AccountSidebar, SettingsSidebar, ChartLibraryModal, etc.) and apply the same fix wherever `hover:bg-accent` appears without `hover:text-accent-foreground`.

### The fix

Add the paired class everywhere it's missing:

- `hover:bg-accent` → `hover:bg-accent hover:text-accent-foreground`

For rows containing icons styled with `text-muted-foreground`, also add `group` + `group-hover:text-accent-foreground` on the icon (or rely on `currentColor` where SVGs already inherit) so the icon flips to white on hover.

For non-active items in the date preset list and month/year pickers, the same paired class fix applies. Active state (`bg-primary text-primary-foreground` / `bg-accent font-medium`) is already correct and unchanged.

### Files touched

- `src/components/layout/DisplayModeSelector.tsx`
- `src/components/layout/DateRangeCalendar.tsx`
- `src/components/layout/GlobalHeader.tsx`
- `src/components/layout/AdvancedFiltersPanel.tsx`
- `src/components/layout/SidebarAccountMenu.tsx` (if affected)
- Plus a sweep through the remaining ~12 files where `hover:bg-accent` appears without the paired text class — same single-class addition each time.

### Out of scope

- No theme variable changes (don't repaint `--accent`).
- No layout/spacing changes.
- shadcn primitives (`DropdownMenuItem`, `SelectItem`, `Command`) already pair `focus:bg-accent focus:text-accent-foreground` internally — they don't need edits.

