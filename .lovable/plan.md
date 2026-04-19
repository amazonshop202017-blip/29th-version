## Goal

Validate the existing ISO standardization and finish enforcing it: every write goes through `nowISO()` / `toISO()`, every "today / day-key" derived from a local instant is computed in **local** calendar (not UTC slice), and add a small audit/log path so any non-canonical legacy value gets flagged once on load.

## Findings (from audit)

**Already correct ✅**

- `datetime.ts` helpers, type aliases (`ISODateString`) on Trade/Diary/Accounts/Transactions/Strategies/SymbolTickSize.
- Migrations on load for Trades, Challenges, Accounts, PropFirm Transactions (date field).
- Filter range logic (`useAccountScopedFilteredTrades`): uses `parseISO` + `startOfDay`/`endOfDay` → already **local-time** correct.
- Date-range presets (`GlobalFiltersContext.applyDatePreset`): uses `date-fns` local helpers ✅.
- Display: every renderer uses `new Date(iso)` / `format(...)` → automatically local ✅.
- Diary `linkedDate` correctly stays `YYYY-MM-DD` per spec.

**Needs fixing ❌**


| #   | File / Line                                                                                                                                                                                                                                                          | Issue                                                                                                                                                                                                                                                                                                                              | Fix                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `TradeModal.tsx:38` `defaultEntry()`                                                                                                                                                                                                                                 | `new Date().toISOString().slice(0,16)` produces a UTC-clock string for a `datetime-local` input → wrong default time in non-UTC zones                                                                                                                                                                                              | Use `isoToDateTimeLocalInputValue(nowISO())`                                                                                                                                                                                                                                |
| 2   | `DiaryContext.tsx` ×6, `types/diary.ts` ×3, `AccountsContext.tsx` ×2, `TransactionsContext.tsx` ×4, `StrategiesContext.tsx`, `SymbolTickSizeContext.tsx` ×2, `ScreenshotsTab.tsx`, `TpSlSettings.tsx`, `FeesSettings.tsx`, `PropFirmAccounts.tsx:336` (`breachedAt`) | Direct `new Date().toISOString()` writes                                                                                                                                                                                                                                                                                           | Replace with `nowISO()` from `@/lib/datetime`                                                                                                                                                                                                                               |
| 3   | `AddEditTransactionModal.tsx:129`, `PayoutModal.tsx:49`                                                                                                                                                                                                              | `data.date.toISOString()` — Date is from a `<Calendar>` (local-midnight Date object) and is fine, but route through `toISO(date)` for consistency                                                                                                                                                                                  | `toISO(date)`                                                                                                                                                                                                                                                               |
| 4   | `TransactionsAutoSync.tsx:25,40`                                                                                                                                                                                                                                     | Fallback `new Date().toISOString()`                                                                                                                                                                                                                                                                                                | `nowISO()`                                                                                                                                                                                                                                                                  |
| 5   | `propFirmStats.ts:88, 234`                                                                                                                                                                                                                                           | `todayKey = new Date().toISOString().slice(0,10)` → **UTC** day-slice. Mismatches `m.closeDate.split('T')[0]` (which is the **stored UTC** day, but compared against in EOD logic the user expects **local** day boundaries to define "today"). Currently consistent (both UTC), but misleading vs. local-day filtering elsewhere. | Add a tiny local-day helper `localDayKey(iso)` in `datetime.ts` and use it consistently across both sides of the comparison (here + `RealPropFirmAccountDetails.tsx:290` + the bucket key derivations on lines 250, 260-263). This aligns "today" with the user's calendar. |
| 6   | `RealPropFirmAccountDetails.tsx:250, 260-263, 290`                                                                                                                                                                                                                   | `iso.slice(0,10)` and `d.toISOString().slice(0,10/13)` — bucket keys + "today" use UTC slice, so a trade at 23:30 local on Apr-19 buckets into Apr-20 in negative-UTC zones (or vice versa)                                                                                                                                        | Use new `localDayKey(iso)` and `localHourKey(iso)` helpers                                                                                                                                                                                                                  |
| 7   | `DayDetailsModal.tsx:104`                                                                                                                                                                                                                                            | `entryDate.toISOString().slice(0,16)` for prefilling the Add Trade modal → loses local tz                                                                                                                                                                                                                                          | `isoToDateTimeLocalInputValue(entryDate.toISOString())`                                                                                                                                                                                                                     |
| 8   | `types/trade.ts:202-203`                                                                                                                                                                                                                                             | `openDate/closeDate` already produced via `.toISOString()` from `Date.getTime()` → already absolute UTC ✅ — **no change**, just adding a code-comment to lock the intent                                                                                                                                                           | &nbsp;                                                                                                                                                                                                                                                                      |
| 9   | `DiaryContext.tsx:132,192`                                                                                                                                                                                                                                           | `toLocaleDateString('en-US', ...)` for note titles → display only, fine. **No change.**                                                                                                                                                                                                                                            | &nbsp;                                                                                                                                                                                                                                                                      |
| 10  | `DEFAULT_FOLDERS` in `types/diary.ts`                                                                                                                                                                                                                                | Folder `createdAt` evaluated at module load time (effectively a constant). Harmless. Switch to `nowISO()` for consistency.                                                                                                                                                                                                         | &nbsp;                                                                                                                                                                                                                                                                      |


**Audit logging (one-time, dev only)**

In `useTrades.ts`, `ChallengesContext`, `AccountsContext`, `TransactionsContext` — after migration, walk persisted dates and `console.warn(...)` any value that fails `isCanonicalISO(...)` so we surface anything the migration missed. (Helper already exists.)

## Files touched

- `src/lib/datetime.ts` — add `localDayKey(iso)` and `localHourKey(iso)` (returns `YYYY-MM-DD` / `YYYY-MM-DD HH` from a UTC ISO using local clock).
- `src/components/trades/TradeModal.tsx` — line 38 default datetime via `isoToDateTimeLocalInputValue(nowISO())`.
- `src/components/dayview/DayDetailsModal.tsx` — line 104 use `isoToDateTimeLocalInputValue`.
- `src/contexts/DiaryContext.tsx` — replace 6× `new Date().toISOString()` with `nowISO()`.
- `src/contexts/TransactionsContext.tsx` — replace 4× direct calls with `nowISO()`.
- `src/contexts/AccountsContext.tsx` — replace remaining 2× `new Date().toISOString()` with `nowISO()`.
- `src/contexts/StrategiesContext.tsx` — `nowISO()`.
- `src/contexts/SymbolTickSizeContext.tsx` — 2× `nowISO()`.
- `src/components/trades/ScreenshotsTab.tsx`, `src/components/settings/TpSlSettings.tsx`, `src/components/settings/FeesSettings.tsx` — `nowISO()`.
- `src/components/propfirm/PropFirmAccounts.tsx` — `breachedAt = nowISO()`.
- `src/components/propfirm/AddEditTransactionModal.tsx`, `PayoutModal.tsx`, `TransactionsAutoSync.tsx` — `toISO(date)` / `nowISO()`.
- `src/lib/propFirmStats.ts` — `todayKey` via `localDayKey(new Date().toISOString())`; same util used to derive `m.closeDate`'s day for comparison.
- `src/components/propfirm/RealPropFirmAccountDetails.tsx` — bucket + `today` keys via the

&nbsp;

&nbsp;

-----------------------------------

SAFETY & VALIDATION (IMPORTANT)

-----------------------------------

- Do NOT modify existing business logic or calculations

- Do NOT change how dates are interpreted — only standardize format and local/UTC alignment

-----------------------------------

POST-IMPLEMENTATION VALIDATION

-----------------------------------

After changes, verify:

1. Trade creation:

   - Default datetime matches user’s local current time

   - Saved value is correct ISO UTC

2. Filters:

   - "Today" filter shows correct trades based on local date

   - Cross-midnight trades appear in correct day

3. Charts:

   - Daily / hourly buckets align with local calendar

   - No shift in dates after fix

4. Transactions:

   - Dates match selected day in UI

   - Filters work correctly

5. Prop firm:

   - EOD logic uses correct local day boundaries

   - No unexpected shifts in drawdown behavior

-----------------------------------

ROLLBACK SAFETY

-----------------------------------

- Do NOT delete or mutate existing stored data beyond ISO normalization

- All migrations must remain idempotent

- If any inconsistency is detected, log it instead of forcing transformation

-----------------------------------

GOAL

-----------------------------------

Ensure improvements do not break existing user-visible behavior while fixing timezone and ISO consistency issues.