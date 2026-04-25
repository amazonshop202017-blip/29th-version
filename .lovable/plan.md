## Zerodha Tradebook Import

Implements a full Zerodha CSV importer following the same architecture as the Tradovate Fills pipeline, with two important additions: support for **open trades** and a UI checkbox that controls whether they are included.

### What the user will see

In the **Import Trades** modal, when `Import Source = Zerodha (Tradebook)`:

- A new checkbox **"Import Open Trades"** appears (default: **unchecked**).
  - Checked → trades whose net position never returns to zero are imported as open trades.
  - Unchecked → open positions are silently discarded (current Tradovate Fills behavior).
- File picker accepts `.csv`.
- Hint text replaces the current "not yet implemented" message.

The existing **"Use Fee Rules to apply fees on imported trades"** checkbox continues to work and applies to Zerodha as well (when checked, matching Symbol Fee Rules win; otherwise no fees are attached because Zerodha tradebook rows have no commission column).

### How it works

1. **Header detection** (case-insensitive, order-independent). Required columns:
  `symbol`, `order_execution_time`, `trade_type`, `quantity`, `price`.
2. **Row parsing & validation** — skip rows with quantity = 0, invalid timestamp, invalid side, or missing price. Timestamp format `YYYY-MM-DDTHH:mm:ss` (or `YYYY-MM-DD HH:mm:ss`) is parsed and normalized to ISO UTC.
3. **Group by symbol, sort by datetime ASC**.
4. **Position engine** — reuses the exact same logic as Tradovate Fills (scale-in, scale-out, full close, reversal splitting). No symbol-rule gating: Zerodha is equity/options where `contractSize = 1` is correct.
5. **Open-position handling** — after walking each symbol, if `position !== 0`:
  - `importOpenTrades = true` → finalize the in-flight fills as an **OPEN** trade (entries only, no exit fills).
  - `importOpenTrades = false` → discard.
6. **Fingerprint generation**:
  - **Closed**: `imported_acct_SYMBOL_entryTime_exitTime_avgEntry_avgExit_qty` (existing format).
  - **Open**: same shape but with empty `exitTime`/`exitPrice` and an appended `_OPEN` marker — guarantees no collision with a future closed trade for the same entry.
7. **Deduplication** — against stored fingerprints + intra-file (same as existing imports).
8. **Insert** via `bulkAddTrades` and report `{ tradesImported, duplicatesSkipped, rowsSkipped, importedSymbols }`.

### Technical changes

**New file: `src/lib/zerodhaTradebookImport.ts**`

- `parseZerodhaTradebookCSV(csv)` → `{ rows, skipped }`.
- `reconstructZerodhaTrades(rows, accountId, balanceSnapshot, { importOpenTrades, applyFeeRules })` → `TradeFormData[]`.
  - Mirrors `reconstructTradesFromFills` from `tradovateFillsImport.ts`, minus `hasSymbolRule` / `getContractSize` (uses `contractSize = 1`).
  - In `finalize()`, accepts a flag `isOpen: boolean`. When open: emits a trade with only the open-side `entries` / `scaleEntries` (no `scaleExits`), `manualFees` resolved via Fee Rules only (CSV has none), and a fingerprint built with `_OPEN` suffix.
- `importZerodhaTradebook(file, accountId, balanceSnapshot, bulkAddTrades, existingFingerprints, options)` → result object identical in shape to `TradovateImportResult` (no `missingSymbols`).

**Fingerprint extension: `src/lib/tradeFingerprint.ts**`

- Add an optional `isOpen?: boolean` field to `FingerprintInput`. When true, append `_OPEN` to the joined string. Update `buildFingerprintForTrade` to accept an optional `{ isOpen }` overload, used only by the Zerodha path. Existing call sites are unchanged.

**Modal: `src/components/settings/AccountImportModal.tsx**`

- Add state: `importOpenTrades: boolean` (default `false`), reset in `resetForm`.
- Render the **"Import Open Trades"** checkbox conditionally when `importSource === 'ZerodhaTradebook'` (placed right under the existing "Use Fee Rules" checkbox).
- Replace the current `ZerodhaTradebook` "not yet implemented" guard with a real branch that calls `importZerodhaTradebook(...)` and forwards `applyFeeRules` + `importOpenTrades`.
- Update the hint text under the file picker to: *"Upload a Zerodha tradebook CSV export. Optionally include open positions."*
- `acceptedFileTypes` for `ZerodhaTradebook` → `.csv`.

### Acceptance criteria

- Selecting Zerodha (Tradebook) shows the new checkbox; default unchecked → open positions discarded.
- A CSV containing 5 closed + 2 open positions, with checkbox unchecked, imports 5 trades; with checkbox checked, imports 7 (the 2 open ones have no exit entries and are flagged as `OPEN` via the entries math in `calculateTradeMetrics`).
- Re-importing the same file imports 0 trades and reports the correct duplicates count.
- Importing the same file once with checkbox unchecked, then again with it checked, imports the previously-skipped open trades the second time (because their fingerprints carry `_OPEN` and were never seen before).
- After an open trade is later closed and re-imported, the new closed trade's fingerprint differs from the old open one — both can coexist (and the user can manually delete the old open trade if desired). This is the explicit intended semantics: open and closed are separate identities.
- Fee Rules toggle behaves identically to Tradovate Fills: ON + matching rule → rule fee; OFF or no rule → no fees (Zerodha tradebook has no commission column).

---

## POSITION ENGINE STATE SAFETY

After each trade finalization:

- position must reset to 0
- currentTradeFills must be cleared
- direction must be reset

---

## GOAL

Prevent state leakage between trades. 

little plan change: 

okay do one thing, in this plan : we gonna skip the open trade logic, we will only import closed trade, so that checkbox is not added as well. 