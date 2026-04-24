# Fix Tradovate Fills Import — Scale In/Out + Rule-Based PnL

## Problems Observed

1. **Quantity shows wrong value (e.g. "1") for multi-fill trades**
   Trades reconstructed from fills (e.g. BUY 1 → BUY 1 → SELL 2) currently store all executions in `entries[]` but leave `scaleEntries` / `scaleExits` empty. When the user opens the trade in the Trade modal, it falls back to the simple "Entry / Exit" view and shows only the first execution's quantity (1), hiding the additional scale-ins and the larger exit.

2. **PnL ignores Symbol Tick/Pip rules for imported fills**
   `calculateTradeMetrics` reads `trade.contractSize` (a snapshot stored on each trade). The Fills import deliberately leaves `contractSize` undefined, so it defaults to `1`. Result: PnL is computed at qty × 1 instead of qty × ruleContractSize. Manual trades work because the Trade modal reads the rule and stores it on `contractSize` at save time.

## Fix

Mirror exactly what the Trade modal "Save" button does for manual scale-in/out trades:

- Build `scaleEntries` and `scaleExits` arrays alongside `entries[]` so the modal renders the full scale view.
- Snapshot `contractSize` from the per-account Symbol Tick/Pip rule onto the trade at import time (same as MT5 / Positions imports).

### Changes

**`src/lib/tradovateFillsImport.ts`**
- For each reconstructed trade, in addition to `entries[]`, populate:
  - `scaleEntries`: one row per opening fill (`{ id, price, quantity }`).
  - `scaleExits`: one row per closing fill (`{ id, price, quantity }`).
  - "Opening" = same direction as the trade's `side` (BUY for LONG, SELL for SHORT).
  - "Closing" = opposite direction.
- Accept a new resolver function `getContractSize(accountId, symbol) => number` (passed by the modal) and store the returned value on `trade.contractSize`.
- Drop the comment about "leave contractSize undefined" — we now snapshot it the same way MT5 / Positions imports do.
- Fingerprint generation order is unchanged (still computed on the final trade object before dedup).

**`src/components/settings/AccountImportModal.tsx`**
- Pass `getContractSizeForAccountSymbol` from `useSymbolTickSize()` into `importTradovateFills(...)`.
- No other behavioral change: the existing `hasSymbolRule` guard still blocks unconfigured symbols, so `getContractSize` is only called for symbols guaranteed to have a rule.

### Why this matches the Trade modal save behavior
- The modal stores `scaleEntries` / `scaleExits` when the user adds scale rows (TradeModal.tsx ~574-575).
- The modal snapshots `contractSize` from `getContractSizeForAccountSymbol(...)` at save time (TradeModal.tsx ~595-597).
- Imported fills will now produce identical-shape trade objects, so all downstream rendering (table quantity, modal scale view, PnL via `calculateTradeMetrics`) behaves the same as a hand-built scale-in/out trade.

### Out of scope (unchanged)
- CSV parsing, position engine logic (open/close/reversal handling), dedup, missing-symbols modal, Tradovate Positions import, MT5 import.

## Expected Outcome

For a fills sequence `BUY 1 @ A → BUY 1 @ B → SELL 2 @ C` on a LONG trade with a configured rule (tickSize, contractSize=N):
- Trades table shows quantity **2**.
- Opening the trade in the modal shows two scale entries (1 + 1) and one scale exit (2).
- PnL = `(C − avgEntry) × 2 × N − fees`, matching what a manually-built equivalent trade would compute.
