## Problem

Trades imported from Tradovate Fills cannot be meaningfully edited in the Trade modal:

1. **PnL is frozen.** Changing entry/exit price, quantity, or direction does not update PnL.
2. **Commission is invisible.** Per-fill commissions are stored on each `entry.charges` but never surfaced as trade-level Fees, so users can't see/edit total fees and Net PnL doesn't reflect them in the modal in the same way as manual trades.
3. **Root cause:** Imported trades carry both `entries[]` (every fill) AND `scaleEntries`/`scaleExits[]` (mirror of fills). When the user opens the modal:
  - The modal's "simple Entry/Exit" sync effect rewrites `entries[]` to a 2-row array (one BUY + one SELL using the typed price/qty), but leaves `scaleEntries`/`scaleExits` untouched with the original fill data.
  - `calculateTradeMetrics` reads `openQuantity` from `scaleEntries`/`scaleExits` but reads avg prices from `entries[]`. The two diverge → PnL appears stuck.
  - Save then persists this inconsistent shape.

## Goal

Imported scale trades should behave **exactly like manually-built scale trades**:

- Editing entry price / exit price / quantity / direction recomputes PnL via `calculateTradeMetrics` using the current symbol rule's contract size.
- No per-trade hardcoded `manualGrossPnl`. Contract size remains snapshotted (already correct) so PnL stays accurate even if the rule changes later.
- Per-fill commissions are summed and stored as the trade-level `manualFees`, mirroring what a user would type into the Fees field.

## Changes

### 1. `src/lib/tradovateFillsImport.ts` — sum commissions into trade-level fees

In `reconstructTradesFromFills` → `finalize()`:

- Compute `totalCommission = sum of currentFills[].charges`.
- On the constructed `TradeFormData`:
  - Set `manualFees: totalCommission` (so Fees field shows the aggregated commission and Net PnL = Gross − Fees).
  - Set each `entries[].charges = 0` (avoid double-counting; `calculateTradeMetrics` ignores `entries[].charges` when `manualFees` is defined, but zeroing is cleaner and survives any future code paths).
- Do **not** set `manualGrossPnl`. Gross PnL must always come from `calculateTradeMetrics`.
- Keep `contractSize` snapshot from `getContractSize(accountId, symbol)` (already in place — needed so PnL is correct).
- Keep `scaleEntries` / `scaleExits` (needed for the modal's scale view).

### 2. `src/components/trades/TradeModal.tsx` — keep entries in sync with scaleEntries/scaleExits when editing scale trades

Today the "simple field" sync effect (around line 167–201) blindly rewrites `entries[]` from the single Entry/Exit/Quantity inputs whenever the user types. For scale trades, this destroys the per-fill structure and decouples `entries[]` from `scaleEntries`/`scaleExits`.

Fix the sync effect so its behavior depends on whether the trade is a scale trade:

- **Non-scale trade** (`scaleEntries.length === 0`): keep current behavior — write a 2-row entries array from the simple fields.
- **Scale trade** (`scaleEntries.length > 0`):
  - Rebuild `entries[]` from the current `scaleEntries` + `scaleExits` arrays (one entry per scale row, BUY/SELL from `direction`).
  - Use `entryDate` for all opening rows' `datetime` and `exitDate` for all closing rows (preserves original ordering for avg-price math; granular fill-level timestamps aren't editable in the simple view, so collapsing them is acceptable and matches manual scale behavior).
  - Set every entry's `charges` to `0`; trade-level fees come from the Fees field (`manualFees`).

Also update the **Quantity / Entry Price / Exit Price** simple fields for scale trades so editing them updates the underlying scale rows proportionally — or, simpler and matches manual scale trades: when `scaleEntries.length > 0`, **disable** the simple Quantity field and show the aggregated qty (read-only from scaleEntries sum). Editing entry/exit prices in the simple inputs proportionally rewrites all scale rows' prices to the typed value (i.e. user collapses to a single avg price). This matches what a user would do manually if they wanted to flatten a scale trade for editing.

Concrete UX rule:

- Quantity field: read-only when `scaleEntries.length > 0`, displays sum.
- Entry Price field: editable. On change, set every `scaleEntries[i].price` to the typed value.
- Exit Price field: editable. On change, set every `scaleExits[i].price` to the typed value.
- Direction toggle: still works; flips BUY/SELL when `entries[]` is rebuilt.
- Fees field: editable as today (preloaded from `manualFees`, which now includes summed commissions).

Result: as soon as the user changes any of these, `entries[]` is rebuilt from `scaleEntries`/`scaleExits`, `calculateTradeMetrics` runs against consistent data, and PnL moves live exactly like a manual trade.

### 3. Save path — no special-casing for imported trades

`handleSubmit` already snapshots `contractSize` from `editingTrade.contractSize` on edit (line 595–597), which is correct. No change needed.

- `manualGrossPnl` stays `undefined` for imported trades (we never set it in the import).
- `manualFees` gets the user's edited value (or the imported commission sum if untouched).

## Out of scope

- CSV parser, position engine, dedup, missing-symbols modal — unchanged.
- MT5 / Tradovate Positions imports — unchanged.
- Per-fill timestamp editing — not exposed in simple view; ScaleInOutModal still allows row-level edits if needed.

## Expected outcome

For an imported sequence `BUY 1 @ 100 → BUY 1 @ 102 → SELL 2 @ 105` with commission $1.50 per fill on ES (contractSize=50):

- After import: Trade shows qty 2, avg entry 101, avg exit 105, Gross = (105−101)×2×50 = $400, Fees = $4.50, Net = $395.50.
- User opens edit, changes Exit Price from 105 → 106:
  - Both `scaleExits` rows update to 106.
  - `entries[]` rebuilt → avg exit = 106.
  - Gross recomputes to (106−101)×2×50 = $500, Net = $495.50, **live in the modal**.
- User changes Fees from 4.50 → 5.00:
  - `manualFees` saved = 5.00, Net = $495.00.
- Save → trade persists with the new prices and fees; downstream analytics use the same `calculateTradeMetrics` as manual trades.

import shall work like its working in mt5, we just adding the scale in/out only, that must also be saved in trades local data. check how mt5 trades are added, where which values are put, how it efficiently works afterworks as in thtat user can edit the trades and it works as per the rules added etc but not in tradovate (fills).  in mt5 we can see the value filled in the field of gross pnl, but in tradovate its in placeholder, so match the behaviour just adding this scaling and out. rest you know better