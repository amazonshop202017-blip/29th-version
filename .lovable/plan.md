

## Goal

Add a red "Minimum Balance" (drawdown floor) line to the Account Balance Over Time chart, computed per data point using the **exact same** closed-PnL logic from `propFirmStats.ts`. No duplicated math — extract a small reusable helper from the existing `computeDrawdownState` and call it at each chart point.

## Approach

The chart's `balanceSeries` already walks closed trades chronologically (Daily / Hourly / Per Trade). At each accumulated point I need the floor *as of that point*, not just the current/final floor.

Since `computeDrawdownState` is module-private and operates on the full closed-trade list, I'll factor out its internals so the chart can incrementally derive the floor without rewriting any rules.

## Files & changes

### 1. `src/lib/propFirmStats.ts`

Export a new pure helper:

```ts
export function computeDrawdownFloorSeries(
  startingBalance: number,
  ddType: 'static' | 'eod' | 'trailing',
  ddAmount: number | null,
  // Points already aggregated by the chart, in chrono order.
  // Each point carries: closed-only running balance + the dayKey it belongs to.
  points: { runningBalance: number; dayKey: string }[]
): (number | null)[]
```

Logic (mirrors existing `computeDrawdownState` exactly):
- **static** → constant `startingBalance - ddAmount` for every point.
- **trailing** → walk `points`; `peak = max(peak, runningBalance)`; floor = `peak - ddAmount`. (Each point already represents post-close balance, so this matches the trade-by-trade peak walk.)
- **eod** → walk `points`; track per-day cumulative; when day changes, lock previous day's EOD into peak (excluding today's key). Floor = `peak - ddAmount`. Today's intraday points use the prior peak (no peak update from today), exactly like `computeDrawdownState`.

Also export `getActiveDrawdownSpec` (currently private) so the component can read `ddType` without re-deriving it.

### 2. `src/components/propfirm/RealPropFirmAccountDetails.tsx`

In the `balanceSeries` `useMemo`:
- While building each bucket, also record its `dayKey` (`YYYY-MM-DD` from `closeDate`) and `runningBalance`.
- After the loop, call `computeDrawdownFloorSeries(...)` with the active `ddType` (from `getActiveDrawdownSpec`) and `selectedRules.maxDrawdown`.
- Attach `floor` to each series point: `{ date, balance, floor }`. Starting "Start" point gets the initial floor (= `startingBalance - ddAmount` for static, or `startingBalance - ddAmount` for trailing/eod since peak starts at startingBalance).

Chart updates inside the existing `<AreaChart>`:
- Add a second `<Area>` (or `<Line>`) with `dataKey="floor"`, red stroke `hsl(0,70%,60%)`, dashed (`strokeDasharray="4 4"`), thin fill or no fill.
- Keep the existing yellow/violet balance area unchanged.
- Remove the static `<ReferenceLine y={drawdownFloorLine}>` (now redundant — the dynamic line replaces it). Keep the `Profit Target` reference line as-is.

### 3. Tooltip

Replace `CustomTooltip` to render both rows when present:

```
FEB 12
● Balance:          $50,635.04
● Minimum Balance:  $48,729.36
```

Pull each value from `payload` by `dataKey` (`balance`, `floor`), format with the existing `fmtUsd`-style rounding. Hide the floor row when `floor == null`.

### 4. Y-domain

Extend `yDomain` calc to consider `floor` values too so the red line is always visible (currently only `balance` values are used).

## Consistency guarantees

- `ddType` and `ddAmount` come from `getActiveDrawdownSpec` + `resolveDrawdownAmount` — same path as `computeAccountStats` and `computeDrawdownFloor`.
- The walk uses the **same closed-trade `enriched` list** and the **same chronological order** as `balanceSeries`. No parallel filter, no new ordering rule.
- For the "current" (final) point, `floor` will exactly equal the existing `computeDrawdownFloor(...)` value — verifiable by inspection.
- Per Trade view: each trade is its own point → trailing peak walk matches `computeDrawdownState` trade-by-trade exactly.
- Daily view: each day-bucket's `runningBalance` is the day's EOD balance → matches EOD logic; trailing still walks correctly because peak is monotonic over closed PnL.

## Out of scope

- Changing colors/labels of the existing balance area.
- Adding floor visualization elsewhere (cards, dashboard) — request is chart-only.
- Hourly view EOD nuance: each hourly bucket inherits its day's key; intraday hours of *today* won't bump the peak (matches `computeDrawdownState` which excludes today). No extra logic needed.

