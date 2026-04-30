## Problem

On the Trade Management page, trades show **0R** even when the trade popup clearly displays an achieved R-Multiple like **+3.4R**.

### Root cause

There are two different "R" concepts in the codebase, and they are out of sync:

1. **Modal popup "R-Multiple"** (what the user sees and trusts):
  `(exit − entry) / (entry − stopLoss)` — a **price-based** R using the SL distance as risk.
   Computed in `TradeModal.tsx` as `rMultipleCalculated` (line 830).
2. **Stored `savedRMultiple**` (what `useTrades.reconcileSavedFields` writes):
  `netPnl / trade.tradeRisk` — a **dollar-based** R using the user-entered `tradeRisk` field.

When `tradeRisk` is `0` or missing, the reconciler sets `savedRMultiple = undefined`, and Trade Management falls back to `metrics.rFactor` which is also `netPnl / tradeRisk = 0`. Result: **0R everywhere**, even though the popup correctly shows 3.4R.

The same mismatch can hit `savedReturnPercent` indirectly, but the user's complaint is specifically about R-Multiple, so we'll fix that without changing return % behavior.

## Fix

Make `savedRMultiple` use the **same price-based formula** the trade popup displays. This is the single source of truth the user expects.

### Change `reconcileSavedFields` in `src/hooks/useTrades.ts`

Replace the `savedRMultiple` block so it uses Entry / Stop Loss / Exit price (direction-aware) instead of `tradeRisk`:

```text
savedRMultiple = (exitPrice − entryPrice) / (entryPrice − stopLoss)   // LONG
savedRMultiple = (entryPrice − exitPrice) / (stopLoss − entryPrice)   // SHORT
```

Conditions for computing it:

- Trade is `CLOSED`
- `avgEntryPrice > 0`
- `avgExitPrice > 0` (from `calculateTradeMetrics`)
- `stopLoss > 0`
- `side` set
- Risk distance (`|entry − sl|`) > 0

Otherwise set `savedRMultiple = undefined`.

This matches `rMultipleCalculated` in `TradeModal.tsx` (lines 830–853) exactly, so the value stored is the same number shown in the popup.

### Also update the load-time migration (lines 202–214 of `useTrades.ts`)

The localStorage migration currently backfills `savedRMultiple` from `netPnl / tradeRisk`. Update it to use the same price-based formula so existing trades get corrected on next load (one-time migration via `isMissing || isStaleZero || sign-mismatch-with-netPnl` check). Trades without entry/SL/exit remain `undefined`.

### Leave alone

- `savedRRR` (planned RR from Entry/SL/TP) — already correct.
- `savedReturnPercent` — already correct (uses frozen `accountBalanceSnapshot`).
- `accountBalanceSnapshot` immutability — already correct.
- `metrics.rFactor` in `types/trade.ts` — internal, unrelated to user-facing R-Multiple. Not changing.
- The Trade Management page itself — already prefers `savedRMultiple` over `metrics.rFactor`, so once storage is fixed it will display correctly.

## Files to edit

- `src/hooks/useTrades.ts`
  - Rewrite the `savedRMultiple` branch in `reconcileSavedFields` to use the price-based formula.
  - Update the migration block (≈ lines 202–214) to recompute legacy `savedRMultiple` with the same formula.

## Result

- Trade popup R-Multiple = stored `savedRMultiple` = value shown on Trade Management page.
- Edits to entry, exit, stopLoss, or direction propagate to `savedRMultiple` automatically (already covered by `reconcileSavedFields` running on every add/update).
- Existing trades with `0R` get corrected on next load via the migration.

okay, also there is no trade risk or anyuthing similar where user enters in $ terms, check tradepopup again, we have everything based on pricing.. rest plan is correct..