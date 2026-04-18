# Wire Prop Firm Dashboard to Live Data

The `BreachInsights` card is already wired. The remaining four widgets (`MetricCards`, `ROIChart`, `FinanceBreakdown`, `PassingInsights`) currently show mock data — I'll replace them with memoized calculations from `AccountsContext`, `ChallengesContext`, `TransactionsContext`, and `TradesContext`.

## 1. `MetricCards.tsx` — full rewrite

Compute live values:

- **Funded card**: `accounts.filter(a => a.step === 'funded' && a.status === 'funded' && !a.isArchived)`. Balance = Σ `getAccountWithStats(a.id).currentBalance`; sub-line = `${count} funded account(s)`.
- **Evaluation card**: `accounts.filter(a => a.phase === 'evaluation' && a.status === 'active' && !a.isArchived)`. Balance = Σ current balance.
- **Total Spent**: `Σ tx.amount` where `type === 'expense'`, `status !== 'ignored'`, category in `evaluation_fee | activation_fee | reset | other_expense`.
- **Total Earned**: `Σ tx.amount` where `type === 'income'`, `status !== 'ignored'`, category in `payout | refund | commission | other_income`.
- **Net Total**: `earned − spent`; ROI% = `spent > 0 ? (net/spent)*100 : 0`. Color green when ≥0, rose when <0.

All wrapped in a single `useMemo` keyed on `[accounts, transactions, getAllAccountsWithStats]`.

Add a **second row** (3 cards) for Pass Rate / Avg Days to Funded / Avg Trades to Funded:

- **Pass Rate**: `passed = accounts.filter(a => a.status === 'completed' && a.step !== 'funded').length`; `attempted = accounts.filter(a => a.phase === 'evaluation' && a.step !== 'funded').length`. Rate = `passed/attempted * 100`.
- **Avg Days to Funded**: For each funded account, find earliest account in same `challengeId`; `days = (fundedAccount.createdAt − step1.createdAt) / 86400000`. Average.
- **Avg Trades to Funded**: For each funded account, gather trades from all accounts sharing its `challengeId` with `closeDate ≤ fundedAccount.createdAt` (using `calculateTradeMetrics(t).closeDate`). Average count.

## 2. `ROIChart.tsx` — full rewrite

Build cumulative time series from non-ignored transactions:

```ts
const sorted = txs.sort((a,b) => +new Date(a.date) - +new Date(b.date));
let cumIn=0, cumEx=0;
const points = sorted.map(t => {
  if (t.type==='income') cumIn += t.amount; else cumEx += t.amount;
  return { date: t.date, income: cumIn, expenses: -cumEx, roi: cumIn - cumEx };
});
```

Then bucket by period ("1W" = last 7d daily, "1M" = last 30d every ~5d, "1Y" = last 12 months monthly). For empty buckets carry forward last cumulative values. Keep existing chart UI (areas, gradients, tooltip, period switcher). Show centered empty state when no transactions.

## 3. `FinanceBreakdown.tsx` — full rewrite

Compute groups based on `activeTab`:

- **By firm**: group txs by `challenges.find(c => c.challengeId === tx.challengeId)?.firm ?? tx.firm`.
- **By account type**: map `challenge.steps` → `1 → "1-step"`, `2 → "2-step"`, `0 → "Instant"`. Group txs by lookup.
- **By account size**: `challenge.balanceAmount` formatted to bucket label (`10K`, `50K`, `100K`, etc. via the same helper as BreachInsights).
- **Expenses**: group expense txs by category (`evaluation_fee`, `activation_fee`, `reset`, `other_expense`).

For each group: `spent`, `earned`, `net = earned − spent`, `barProgress = (max(spent,earned) / globalMax)*100`, `percent = (groupVolume / totalVolume)*100`. Use distinct color palette `["#22c55e","#6366f1","#f59e0b","#ec4899","#06b6d4","#8b5cf6"]`. Donut center shows total net across groups; if no data, render empty state.

## 4. `PassingInsights.tsx` — full rewrite

Group accounts (eval-only, exclude `step === 'funded'` and instant funded `steps === 0`) by:

- **By firm** → `challenge.firm`
- **By account type** → `challenge.steps` mapped to "1-step" / "2-step"
- **By account size** → balance bucket
- **By strategy** → flatten `challenge.setups[]` (one row per setup an account uses)

For each group: `attempted = total in group`; `passed = those where status === 'completed'`. `pct = passed/attempted * 100`. Render as existing list with progress bar and "Passed X out of Y accounts" sub-line. Empty state when no eval data.

## 5. Shared helpers

Create `src/lib/propfirmDashboardStats.ts` with pure functions:

- `getNonIgnoredTxs(txs)`
- `formatSizeBucket(n)` (reuse from BreachInsights)
- `accountTypeLabel(steps)`
- `groupTransactions(txs, getKey)` → `Map<key, {spent, earned}>`

Pure-function structure keeps everything memoizable and SQL-translatable per spec §11.

## 6. No changes needed

- `PropFirmDashboard.tsx` layout stays the same.
- `BreachInsights.tsx` already wired correctly.
- Contexts unchanged.

## Files modified

- `src/components/propfirm/MetricCards.tsx`
- `src/components/propfirm/ROIChart.tsx`
- `src/components/propfirm/FinanceBreakdown.tsx`
- `src/components/propfirm/PassingInsights.tsx`

## Files created

- `src/lib/propfirmDashboardStats.ts`

&nbsp;

## FINAL IMPLEMENTATION SAFETY (IMPORTANT)

1. IMMUTABLE SORTING (CRITICAL)

- Never call .sort() directly on context/state arrays (transactions, accounts, trades).

- .sort() mutates the original array and can break React state consistency.

Always clone before sorting:

  const sorted = [...txs].sort((a, b) => ...)

Apply this rule in:

- ROIChart (time-series sorting)

- Any grouping or ordering logic across dashboard components

-----------------------------------

2. SAFE RELATION RESOLUTION (NO CRASHES)

When resolving linked data:

- challengeId → challenge

- accountId → account

Always use safe fallback:

  const challenge = challenges.find(c => c.challengeId === tx.challengeId);

  const firm =

    challenge?.firm ??

    tx.firm ??

    "Unknown";

  const challengeName =

    challenge?.nickname ??

    "Deleted Challenge";

- Never access properties like challenge.firm without optional chaining.

- UI must not break if a related entity is missing (deleted or not found).

-----------------------------------

3. GOAL OF THESE RULES

- Prevent hidden state mutation bugs

- Ensure dashboard stability even with partial/missing data

- Maintain React best practices (immutability)

- Keep logic safe for future database migration