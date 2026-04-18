

The current implementation in `MetricCards.tsx` is mostly correct but has issues:

1. Uses `.reduce()` with mutation-safe lookup but does NOT explicitly sort by `createdAt ASC` — it just picks the min, which is functionally equivalent but not aligned with the spec.
2. Edge case: if only one funded account exists in a challenge (no Step 1/2 records), `earliest` becomes the funded account itself → `days = 0`. Per spec, this should be skipped (startDate missing) OR return its days (which is 0). The user says "if only one funded account → return its days" referring to one funded account total, not one account in challenge.
3. No timestamp validation — invalid `createdAt` could produce NaN.
4. No empty-state return of `0` (currently returns `null` which renders "—").

## Fix in `src/components/propfirm/MetricCards.tsx`

Replace the Avg Days to Funded block (~lines 47-58) with:

```ts
const fundedAll = accounts.filter(a => a.step === "funded" && a.status === "funded");
const daysList: number[] = [];

for (const fa of fundedAll) {
  const fundedTs = new Date(fa.createdAt).getTime();
  if (!fa.challengeId || !isFinite(fundedTs)) continue;

  // ALL accounts in challenge (no archive filter)
  const sameChallenge = accounts.filter(x => x.challengeId === fa.challengeId);
  if (!sameChallenge.length) continue;

  // Sort ASC by createdAt (immutable clone), pick earliest with valid date
  const sorted = [...sameChallenge]
    .filter(x => isFinite(new Date(x.createdAt).getTime()))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const startDate = sorted[0];
  if (!startDate) continue; // skip if startDate missing

  const days = (fundedTs - new Date(startDate.createdAt).getTime()) / 86400000;
  if (isFinite(days) && days >= 0) daysList.push(days);
}

const avgDays = daysList.length ? daysList.reduce((s, n) => s + n, 0) / daysList.length : 0;
```

And update the render so `0` shows as `0d` instead of `—`:

```tsx
{m.fundedTotal > 0 ? `${Math.round(m.avgDays)}d` : "—"}
```

Where `avgDays` defaults to `0` (not `null`) and the dash only shows when there are zero funded accounts at all.

## Files modified

- `src/components/propfirm/MetricCards.tsx`

## Safety

- Immutable `[...sameChallenge].sort(...)` — no mutation of context state.
- Timestamp-based comparison via `getTime()`, not string compare.
- Skips entries with missing/invalid `createdAt`.
- Includes archived accounts (no `isArchived` filter on the challenge lookup).

