

## Bug

Current `Avg Days to Funded` in `MetricCards.tsx`:
- Uses `step1.createdAt` as start date instead of `challenge.startDate`.
- Falls back to `fa.createdAt` (the funded account's creation date) when no trades exist on the final evaluation step → produces fake/inflated days.
- Includes the funded account itself as fallback for completion (`completionAcct = step1` for 1-step), which is fine, but the end-date fallback to `createdAt` is wrong.

## Fix

In `src/components/propfirm/MetricCards.tsx`, rewrite the `Avg Days to Funded` block inside the `useMemo`:

```ts
for (const fa of fundedAll) {
  if (!fa.challengeId) continue;
  const challenge = getChallengeById(fa.challengeId);
  if (!challenge || challenge.steps === 0) continue;          // skip Instant
  if (!challenge.startDate) continue;                          // need real start

  const startTs = new Date(challenge.startDate).getTime();
  if (!isFinite(startTs)) continue;

  // Final evaluation step account
  const finalStep = challenge.steps === 2 ? "2" : "1";
  const stepAcct = accounts.find(
    x => x.challengeId === fa.challengeId && x.step === finalStep
  );
  if (!stepAcct) continue;

  // End date = latest closeDate among that step's trades
  const acctTrades = tradesByAccount.get(stepAcct.id) ?? [];
  const closeTimes = acctTrades
    .map(t => {
      const cd = calculateTradeMetrics(t).closeDate;
      return cd ? new Date(cd).getTime() : NaN;
    })
    .filter(ts => isFinite(ts));

  if (closeTimes.length === 0) continue;                       // SKIP — no fallback
  const endTs = Math.max(...closeTimes);

  const days = (endTs - startTs) / 86400000;
  if (isFinite(days) && days >= 0) daysList.push(days);

  tradesList.push(acctTrades.length);
}
```

Also update the subtitle counter so it reflects only the **valid** funded challenges actually averaged (use `daysList.length`, not `fundedTotal`):

```tsx
<div className="text-xs text-muted-foreground mt-0.5">
  Across {daysList.length} funded
</div>
```

Display `—` when `daysList.length === 0`. Same treatment for `Avg trades to funded` (use `tradesList.length`).

## Files

- `src/components/propfirm/MetricCards.tsx` — replace start-date source (`challenge.startDate` instead of `step1.createdAt`), remove `fa.createdAt` fallback for end date, skip challenges that lack trades on the final evaluation step, and update subtitle counts to reflect only valid challenges.

## Result

- Instant Funded challenges: ignored.
- 1-step / 2-step funded challenges with real trades on the final step: counted using true `challenge.startDate` → latest trade `closeDate`.
- Funded challenges with no trades on the final step: skipped entirely (no inflated days from `createdAt`).
- Subtitle "Across N funded" reflects only the challenges that actually contributed to the average.

