

## Goal

Make all Prop Firm drawdown calculations use **closed-trade P&L only** and respect the chosen drawdown `type` (`static` / `eod` / `trailing`). Floating/open-trade P&L and intraday spikes must never feed peak/drawdown.

## Files & changes

### 1. `src/lib/propFirmStats.ts` — core engine

Replace the current single walking-peak loop with type-aware logic. All loops iterate **only closed trades**, ordered by `closeDate`.

```text
closedTrades = accountTrades.filter(({m}) => m.positionStatus === 'CLOSED')
                            .sort by m.closeDate asc

closedPnl   = sum(closedTrades.netPnl)
currentBal  = startingBalance + closedPnl     // closed-only balance

ddType = step.maxDrawdown.type   // 'static' | 'eod' | 'trailing'
ddAmt  = resolveDrawdownAmount(...)            // dollar amount

switch (ddType):
  STATIC:
    floor          = startingBalance - ddAmt
    currentDrawdown = max(0, startingBalance - currentBal)

  TRAILING:
    running = startingBalance; peak = startingBalance
    for each closed trade in chrono order:
      running += netPnl
      if running > peak: peak = running        // closed PnL only — no intraday
    floor          = peak - ddAmt
    currentDrawdown = max(0, peak - currentBal)

  EOD:
    Build map<dayKey, sum(netPnl of closed trades that day)> using closeDate.
    Walk days in chrono order; eodBal = startingBalance + cumulative day PnL.
    peak = max(startingBalance, max(eodBal across completed days))
       (exclude today so intra-day doesn't move the peak)
    floor          = peak - ddAmt
    currentDrawdown = max(0, peak - currentBal)
```

Update the returned `AccountStats` so `currentDrawdown` and `drawdownPct` come from the branch above. Also change `pnl` and `currentBalance` to be **closed-only** so every downstream widget (cards, table rows, details header) is consistent.

Add an exported helper `computeDrawdownFloor(account, challenge): number | null` so chart `ReferenceLine` and the details page show the correct floor for trailing/EOD (not just `startBalance - ddAmt`).

### 2. `src/components/propfirm/RealPropFirmAccountDetails.tsx`

- Filter `enriched` (and everything derived: `dailyTotals`, `tradeStats`, `balanceSeries`, `dailyLoss`, `consistency`) to `m.positionStatus === 'CLOSED'`. Open trades stop affecting balance curve, daily loss, drawdown, peaks.
- `dailyLoss`: keep current "today by closeDate" logic but only over closed trades.
- `drawdownFloorLine`: replace `startBalance - selectedRules.maxDrawdown` with `computeDrawdownFloor(account, challenge)` so the red reference line tracks the trailing/EOD peak instead of being pinned to start.
- The "Maximum Drawdown" `FundingItem` already reads `stats.currentDrawdown`; it now picks up the type-correct value automatically. Update the `sublabel` "Floor: …" to use the dynamic floor too.

### 3. `src/components/propfirm/RealAccountCard.tsx`

No structural change — it consumes `computeAccountStats`. Once (1) is fixed, the card reflects closed-only P&L, balance, and type-correct drawdown automatically. The fixed "Maximum daily loss: $0" placeholder stays as-is (it's a static label, not live data) — out of scope.

### 4. `src/components/propfirm/MetricCards.tsx` & `PropFirmAccounts.tsx`

These read `computeAccountStats` indirectly (via `accountToRow` and per-account stats). Get fixed for free once (1) lands. No edits required beyond verifying.

### 5. Breach detection

`MarkAsFailedDialog.tsx` is a manual dropdown — no automatic breach evaluation exists today, so no rule-engine changes needed. Type-correct `currentDrawdown` from (1) is what any future check would consume.

## Consistency checklist (post-change)

| Surface | Source | Closed-only | Type-aware |
|---|---|---|---|
| Account card balance / P&L / DD | `computeAccountStats` | ✅ | ✅ |
| Account details header & funding rows | `computeAccountStats` + local closed-filtered enriched | ✅ | ✅ |
| Balance curve & DD floor line | local closed-filtered + `computeDrawdownFloor` | ✅ | ✅ |
| Daily-loss row | closed trades on today's `closeDate` | ✅ | n/a |
| Dashboard `MetricCards` & accounts table | `computeAccountStats` → `accountToRow` | ✅ | ✅ |

## Out of scope

- Backfilling historical "intra-day peak" tracking (we don't store ticks; closed P&L is the only deterministic source).
- Auto-breach engine (none exists; manual mark-as-failed is unaffected).
- Hardcoded `Maximum daily loss: $0` placeholder on the card — unrelated UI mock.

