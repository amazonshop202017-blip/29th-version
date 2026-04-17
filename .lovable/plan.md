## Plan: Real data-driven Account Details page (preserves demo)

### Strategy

Keep `PropFirmAccountDetails.tsx` (demo) **completely untouched**. Create a **new** `RealPropFirmAccountDetails.tsx` that mirrors its layout/UI but is driven by real `Account` + `Challenge` + `Trade` data. Route to it only when the user opens a **real** account; demo cards still open the existing demo page.

### Routing change (`src/pages/PropFirm.tsx`)

- Replace boolean `showAccountDetails` with `selectedAccountId: string | null` (`null` → demo, real id → real).
- Render:
  - `selectedAccountId === 'demo'` → existing `PropFirmAccountDetails` (unchanged)
  - else if matches a real account → new `RealPropFirmAccountDetails accountId=...`
- `PropFirmAccounts` receives `onSelectAccount(id?: string)`. Demo cards/rows pass nothing (defaults to `'demo'`); real cards/rows pass the real `account.id`.

### `PropFirmAccounts.tsx` minor wiring

- Change handler signatures so `onViewDetails` for real rows/cards calls `onSelectAccount(account.id)`. Demo unchanged (passes nothing).
- `handleRowSelect(id)` → if `realIds.has(id)` pass real id, else `'demo'`.

### New file: `src/components/propfirm/RealPropFirmAccountDetails.tsx`

Same JSX skeleton as the demo (header, Step/Funding tabs, balance chart card + path-to-funding side card, stats block, then the **trades table copied verbatim from the demo**). Driven by:

```tsx
const account = getAccountById(accountId);
const challenge = account?.challengeId ? getChallengeById(account.challengeId) : undefined;
const accountTrades = trades.filter(t => t.accountId === accountId);
const stats = computeAccountStats(account, challenge, trades);
```

#### 1. Header

- Title: `account.name`
- Pill text: `phase === 'funded' ? 'Funded Account' : 'Evaluation Account'`

#### 2. Step / Funding tabs

- Tabs `STEP 1`, `STEP 2` (only if `challenge.steps === 2`), `FUNDING`.
- Default selected: `account.step === 'funded' ? 'FUNDING' : account.step === '2' ? 'STEP 2' : 'STEP 1'`.
- Tab is visual highlight only — content beneath uses the rules of the selected tab so users can inspect any step.

#### 3. Balance chart (equity curve)

Build `balanceData` from real trades:

```ts
const sorted = [...accountTrades].sort((a,b) => closeDate(a) - closeDate(b));
let running = account.startingBalance;
const series = [{ date: formatStartedOn(account.createdAt), balance: running }];
for (const t of sorted) {
  running += calculateTradeMetrics(t).netPnl;
  series.push({ date: format(closeDate), balance: running });
}
```

- Group/format X-axis based on `chartView` (`Daily` → group by day, `Hourly` → group by hour, `Per Trade` → one point per trade).
- Y-axis domain: `[min*0.98, max*1.02]` with safe fallback when no trades.
- `ReferenceLine` (Profit Target): `account.startingBalance + stats.profitTargetAmount` (only when defined and not in funded view).
- `ReferenceLine` (Drawdown Floor): `account.startingBalance - stats.maxDrawdownAmount` (when defined).
- Empty state when `accountTrades.length === 0`: render the chart with just the starting point + a centered "No trades yet" overlay.

#### 4. Path to funding panel — uses rules of currently selected tab

Helpers from `propFirmStats.ts`: `resolveTargetAmount`, `resolveDrawdownAmount`. For the selected step (or funded), compute:

- **Profit**: `value = "Profit: ${fmtUsd(stats.pnl, sign)}"`, `label = "Target: {fmtUsd(targetAmount)}"`, `barValue = stats.progressPct`, `percentage = "{progressPct.toFixed(2)}%"`. Hidden in FUNDING tab if no target.
- **Daily Loss**: compute today's PnL:
  ```ts
  const today = new Date().toISOString().slice(0,10);
  const dailyLoss = Math.max(0, -accountTrades
    .filter(t => calculateTradeMetrics(t).closeDate?.slice(0,10) === today)
    .reduce((s,t) => s + calculateTradeMetrics(t).netPnl, 0));
  ```
  Display `value = "${fmtUsd(dailyLoss)}"`, `label = "Maximum daily loss: {fmtUsd(maxDailyLossAmount)}"`, `barValue = clamp(dailyLoss / maxDailyLossAmount * 100)`.
- **Drawdown**: from `stats.currentDrawdown / stats.maxDrawdownAmount`. Sublabel: `Floor: {fmtUsd(startingBalance - maxDrawdownAmount)}`.
- **Consistency** (per the user's definition): "largest single-day profit must be ≤ X% of total profits".
  ```ts
  const dailyTotals = new Map<string, number>(); // date -> sum netPnl that day
  // ...accumulate
  const profitDays = [...dailyTotals.values()].filter(v => v > 0);
  const totalProfit = profitDays.reduce((s,v) => s + v, 0);
  const bestDay = Math.max(0, ...profitDays);
  const currentConsistencyPct = totalProfit > 0 ? (bestDay / totalProfit) * 100 : 0;
  const target = stats.consistencyTarget; // e.g. 50
  ```
  Display:
  - `value = "Consistency: ${target}%"`
  - `sublabel = "Current Consistency: ${currentConsistencyPct.toFixed(0)}%"`
  - `percentage = "${currentConsistencyPct.toFixed(0)}%"`
  - `barValue = currentConsistencyPct` (capped at 100)
  - `threshold = target`, `thresholdLabel = "${target}%"` (vertical marker like demo)
  - Pass status: green check icon when `currentConsistencyPct <= target`, hollow circle otherwise.

#### 5. Stats section (from `accountTrades`)

```ts
const metrics = accountTrades.map(calculateTradeMetrics);
const wins = metrics.filter(m => m.netPnl > 0);
const losses = metrics.filter(m => m.netPnl < 0);
const winRate = metrics.length ? (wins.length / metrics.length) * 100 : 0;
const avgWin = wins.length ? wins.reduce((s,m)=>s+m.netPnl,0) / wins.length : 0;
const avgLoss = losses.length ? losses.reduce((s,m)=>s+m.netPnl,0) / losses.length : 0;
// dailyTotals reused from consistency calc
const bestDay = Math.max(0, ...dailyTotals.values());
const worstDay = Math.min(0, ...dailyTotals.values());
```

Render same 5 rows as demo with computed values (or `—` when no data).

#### 6. Trades table — UNCHANGED

Copy the demo's trades table JSX verbatim, including the hard-coded `trades` array. **Per request: no changes at all to this section**, so the table on the real details page shows identical demo trades. (Will be replaced in a follow-up.)

### Files

**Create**

- `src/components/propfirm/RealPropFirmAccountDetails.tsx` — full real details page (header, tabs, chart, path-to-funding, stats, demo trades table copied as-is).

**Edit**

- `src/pages/PropFirm.tsx` — switch state to `selectedAccountId`, route to demo vs real details.
- `src/components/propfirm/PropFirmAccounts.tsx` — `onSelectAccount` accepts optional `id`; pass real `account.id` from real card/row, nothing from demo.

### Out of scope

- Real trades inside the trades table (explicitly excluded)
- Demo `PropFirmAccountDetails.tsx` (untouched)
- Attach Strategy / Journal / Upload trades buttons (UI only, no behavior change) 

&nbsp;

"make sure whatever data is capturing in backend is only of that particular account, it doesnt get any other account data, as it may crash system in case of large trades data and inconsistent data"

&nbsp;

and also 

Optimize performance by adding useMemo only to expensive computations such as:

- trade filtering

- stats calculation

- chart data generation

Do not add useMemo to simple values or UI logic.

&nbsp;