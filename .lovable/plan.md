## Goal

Persist every timestamp as full ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`). Inputs are interpreted as the user's **local time** (so "April 19, 2:30 PM" entered in a `datetime-local` input becomes the correct UTC instant). Display, filters, sorts, and bucketing continue to operate in local time so the UX is unchanged.

## Audit (from previous exploration)


| Source                                                                                                                                                                     | Currently               | Action                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `Trade.createdAt/updatedAt`, `Account.*`, `PropFirmTransaction.*`, `Account.Transaction.date`, `Challenge.createdAt`, `DiaryNote.*`, `Strategy.*`, screenshots, tick rules | full ISO ✅              | retype only                                                 |
| `TradeEntry.datetime` (manual `<input type="datetime-local">`)                                                                                                             | `YYYY-MM-DDTHH:mm` ❌    | **fix on save (local→UTC), migrate on load**                |
| `TradeEntry.datetime` (MT5 import)                                                                                                                                         | `YYYY-MM-DDTHH:mm:ss` ❌ | **fix on parse (treat as user local→UTC), migrate on load** |
| `Challenge.startDate` (`<input type="date">`)                                                                                                                              | `YYYY-MM-DD` ❌          | **fix on save (local midnight→UTC), migrate on load**       |
| Diary `linkedDate`, `useTrades` `dayKey`, `closeDate.split('T')[0]`                                                                                                        | calendar day-key        | leave as-is (intentional)                                   |


## Plan

### 1. New helpers — `src/lib/datetime.ts`

```ts
export type ISODateString = string;

// LOCAL → UTC ISO. Critical: naive strings are interpreted as USER LOCAL time.
// "2025-04-19"          → new Date("2025-04-19T00:00:00") → .toISOString()  (local midnight)
// "2025-04-19T14:30"    → new Date("2025-04-19T14:30:00") → .toISOString()  (local 2:30 PM)
// "...Z" or "...+02:00" → passed through (already absolute)
// Date / number         → .toISOString()
export function toISO(input: string | number | Date | null | undefined): ISODateString | '';
export function nowISO(): ISODateString;

// UTC ISO → local-time strings for HTML inputs (display only)
export function isoToDateInputValue(iso: string): string;          // YYYY-MM-DD (local)
export function isoToDateTimeLocalInputValue(iso: string): string; // YYYY-MM-DDTHH:mm (local)
```

This guarantees: a user picking "April 19, 2:30 PM" in any timezone always round-trips back to "April 19, 2:30 PM" in their local UI, while storage is unambiguous UTC.

### 2. Fix the 3 leaky write paths

- `**src/components/trades/TradeModal.tsx**` — wrap every `entryDate`/`exitDate` write with `toISO(...)`. When loading a trade for edit, hydrate the input with `isoToDateTimeLocalInputValue(stored)`.
- `**src/lib/mt5Import.ts**` — `parseMT5DateTime` returns `toISO(\`${y}-${m}-${d}T${time})` (treats MT5's broker-local timestamp as user local → UTC).
- `**src/components/propfirm/TrackAccountModal.tsx**` — save `startDate` via `toISO(startDate)`; hydrate input via `isoToDateInputValue(c.startDate)`.

### 3. Type tightening (zero runtime impact)

Add `ISODateString` to:

- `src/types/trade.ts` (`TradeEntry.datetime`, `Trade.createdAt/updatedAt`, `TradeScreenshot.createdAt`)
- `src/types/diary.ts` (`createdAt/updatedAt`)
- Contexts: `ChallengesContext`, `AccountsContext`, `TransactionsContext`, `StrategiesContext`, `SymbolTickSizeContext`, `ScreenshotTagsContext`, `TagsContext`, `CategoriesContext`

### 4. One-time idempotent migration on load

In each context's load `useEffect`, run `toISO(...)` over date fields. Only persist back if any value changed (avoids storage churn). Migrates legacy `YYYY-MM-DD` and `YYYY-MM-DDTHH:mm` values without losing the calendar day/time the user originally entered (because we interpret naive values as local time, identical to how the UI originally stored them).

Migrated fields:

- `useTrades.ts` → `trade.entries[].datetime`
- `ChallengesContext` → `startDate`, `createdAt`
- `AccountsContext` → `createdAt`, `breachedAt`, `transactions[].date`

### 5. Display, filters, sorting — verified unchanged

All current readers use `new Date(value)` / `parseISO(value)` / `.getTime()` / `format(date,…)` / `.split('T')[0]`. Full ISO is a strict superset of what they accept, and `new Date(isoUtc)` automatically renders in **local time** in every UI call site — so calendars, charts, filters, day-bucketing, and date-range pickers all behave identically. Day-keys (`closeDate.split('T')[0]`) intentionally stay as the local-day projection used today.

### 6. Out of scope

- Diary `linkedDate` and `useTrades` derived `dayKey` (intentional day-keys, not timestamps).
- Display-formatting changes (UI stays exactly as-is).

## Files touched

- **new**: `src/lib/datetime.ts`
- **fix writes**: `TradeModal.tsx`, `mt5Import.ts`, `TrackAccountModal.tsx`
- **migrate on load + retype**: `useTrades.ts`, `ChallengesContext.tsx`, `AccountsContext.tsx`
- **retype only**: `TransactionsContext.tsx`, `StrategiesContext.tsx`, `SymbolTickSizeContext.tsx`, `ScreenshotTagsContext.tsx`, `TagsContext.tsx`, `CategoriesContext.tsx`, `types/trade.ts`, `types/diary.ts`

&nbsp;

&nbsp;

-----------------------------------

DIARY DATE HANDLING (IMPORTANT)

-----------------------------------

- For diary_notes:

  - createdAt, updatedAt:

    → MUST use full ISO 8601 format (UTC)

    → stored using toISOString()

  - linkedDate:

    → MUST remain in YYYY-MM-DD format

    → this is a calendar day key, NOT a timestamp

-----------------------------------

RULES

-----------------------------------

- Do NOT convert linkedDate to ISO format

- Do NOT attach time or timezone to linkedDate

- linkedDate is used only for:

  - day-based grouping

  - filtering

  - linking notes to a calendar day

-----------------------------------

GOAL

-----------------------------------

- Preserve correct day-based behavior in UI

- Avoid timezone shifts for diary grouping

- Maintain consistency with existing dayKey logic used in trades

&nbsp;

&nbsp;

## Result

- 100% of stored timestamps are `YYYY-MM-DDTHH:mm:ss.sssZ` UTC — Postgres-ready, lexicographically sortable, timezone-unambiguous.
- User experience is unchanged: input in local time, displayed in local time, filtered/sorted/bucketed in local time.
- Existing localStorage data auto-upgrades on first load with no data loss and no visual shift.