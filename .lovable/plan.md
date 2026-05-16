## Move "Intraday/Multiday" filter to Day & Time section

Relocate the Intraday/Multiday filter row from the Basic Filters section into the Day & Time section. The filter state/logic in `GlobalFiltersContext`, `TradesContext`, and `SelectedFiltersBar` stays unchanged — only the UI placement moves.

### Files to change

1. **`src/components/layout/AdvancedBasicFiltersSection.tsx`**
   - Remove the `Intraday/Multiday` `FilterRow` block.
   - Remove `holdingPeriodFilter`/`setHoldingPeriodFilter` from the `useGlobalFilters()` destructure.
   - Remove the `CalendarDays` import and `HoldingPeriodFilter` type import (no longer used here).

2. **`src/components/layout/AdvancedDayTimeSection.tsx`**
   - Add `holdingPeriodFilter`/`setHoldingPeriodFilter` to the `useGlobalFilters()` destructure and import `HoldingPeriodFilter` type.
   - Add a new `FilterRow` labeled **"Intraday/Multiday"** (icon: `CalendarDays`) with a `Select` (All / Intraday / Multiday) bound to the context, placed at the bottom of the section.
