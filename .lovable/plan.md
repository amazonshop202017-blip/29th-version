## Fix Avg Days to Funded — multi-step aware

Update `src/components/propfirm/MetricCards.tsx` to follow the new spec.

### Logic per funded account

1. Filter funded: `step === 'funded' && status === 'funded'`.
2. Look up `challenge` via `getChallengeById(fa.challengeId)`. Skip if missing or `challenge.steps === 0` (instant funded).
3. Find Step 1 account in same challenge: `accounts.find(x => x.challengeId === fa.challengeId && x.step === '1')`. Skip if missing → `startDate = step1.createdAt`.
4. Determine completion step account based on `challenge.steps`:
  - `1` → step 1 account
  - `2` → step 2 account (`accounts.find(... step === '2')`); skip if missing
5. Get trades for that completion step account: `trades.filter(t => t.accountId === stepAcct.id)`, compute each `closeDate` via `calculateTradeMetrics`, take max timestamp = `endDate`.
6. Fallback: if no valid trade closeDates, `endDate = fa.createdAt`.
7. `days = (endTs - startTs) / 86400000`. Push if finite & ≥ 0.
8. `avgDays = sum/count`.

### Imports to add

- `useChallengesContext` from `@/contexts/ChallengesContext`.

### Code change

Replace the Avg Days block (lines ~46–77). `avgTrades` block stays as-is (separate metric, unchanged scope). Render unchanged — already shows `0d` when funded exist.

```ts
const fundedAll = accounts.filter(a => a.step === "funded" && a.status === "funded");
const daysList: number[] = [];

for (const fa of fundedAll) {
  if (!fa.challengeId) continue;
  const challenge = getChallengeById(fa.challengeId);
  if (!challenge || challenge.steps === 0) continue;

  const step1 = accounts.find(x => x.challengeId === fa.challengeId && x.step === "1");
  if (!step1) continue;
  const startTs = new Date(step1.createdAt).getTime();
  if (!isFinite(startTs)) continue;

  const completionAcct = challenge.steps === 2
    ? accounts.find(x => x.challengeId === fa.challengeId && x.step === "2")
    : step1;
  if (!completionAcct) continue;

  const closeTimes = trades
    .filter(t => t.accountId === completionAcct.id)
    .map(t => {
      const cd = calculateTradeMetrics(t).closeDate;
      return cd ? new Date(cd).getTime() : NaN;
    })
    .filter(ts => isFinite(ts));

  const endTs = closeTimes.length
    ? Math.max(...closeTimes)
    : new Date(fa.createdAt).getTime();
  if (!isFinite(endTs)) continue;

  const days = (endTs - startTs) / 86400000;
  if (isFinite(days) && days >= 0) daysList.push(days);
}

const avgDays = daysList.length ? daysList.reduce((s, n) => s + n, 0) / daysList.length : 0;
```

Add `getChallengeById` to memo deps.

### Files

- `src/components/propfirm/MetricCards.tsx`

&nbsp;

# 🧠 ONLY 1 SMALL THING TO ADD (IMPORTANT)

Right now:

```
trades.filter(...)
```

👉 If `trades` is large, this runs inside a loop → inefficient

---

## 🟡 OPTIONAL (but good practice)

Add this note at end of plan:

```
PERFORMANCE NOTE

- Avoid filtering trades repeatedly inside loop
- Pre-group trades by accountId before loop:

  const tradesByAccount = groupBy(trades, t => t.accountId)

- Then use:
  const accountTrades = tradesByAccount[completionAcct.id] || []

This improves performance for large datasets.
```

---

use this if you think it will be helpful with large trades. 