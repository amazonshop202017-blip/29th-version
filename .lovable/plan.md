## Tradovate Fills Import — Implementation Plan

Reconstruct trades from execution fills via a deterministic position-engine. Unlike the Tradovate Positions importer (which derives contract size from P/L), Fills import **requires Symbol Tick/Pip rules to already exist** — it never auto-creates them.

---

### 1. New file: `src/lib/tradovateFillsImport.ts`

Mirrors the structure of `tradovateImport.ts` but with a fills-based engine.

**Exports**

- `importTradovateFills(file, accountId, accountBalanceSnapshot, bulkAddTrades, existingFingerprints, hasSymbolRule)` → result
- `parseTradovateFillsCSV(csv)` → `{ rows, skipped }`
- `reconstructTradesFromFills(rows, accountId, snapshot, hasSymbolRule)` → `{ trades, missingSymbols, skipped }`

**Result shape**

```ts
{
  success, tradesImported, duplicatesSkipped, rowsSkipped,
  importedSymbols, missingSymbols: { symbol, tickSize }[],
  errors
}
```

#### Header detection (name-based, order-agnostic)

Required columns (case-insensitive, whitespace-normalized):

- `Product` → symbol
- `_timestamp` → execution time **(authoritative — explicitly ignore any plain `Timestamp` column)**
- `_qty` → quantity
- `_price` → price
- `B/S` → side (`B` / `S` / `Buy` / `Sell`)
- `commission` → fees (optional, default 0)
- `_tickSize` → optional (used only for the missing-symbols popup display)

Throw with a clear message when any required column is missing.

#### Timestamp parsing (strict)

Format: `YYYY-MM-DD HH:mm:ss.SSSZ`

Algorithm:

1. Trim
2. Replace the space between date and time with `T`
3. Pass directly to `new Date(...)` — already valid ISO UTC
4. If `isNaN`, skip the row

No locale/MM-DD-YYYY logic. Do not use the existing `parseTradovateDateTime` helper.

#### Row validation — skip when:

- `_qty == 0` or NaN
- `_price` missing/NaN
- `_timestamp` missing/invalid
- `B/S` missing or not B/S/Buy/Sell

#### Sort & group

- Sort all rows: `symbol ASC`, then `datetime ASC`
- Group by symbol

---

### 2. Position engine (per symbol)

State per symbol:

```
position = 0
currentFills = []   // accumulated fills for the in-flight trade
direction = null    // 'LONG' | 'SHORT'
```

For each fill (signed qty: BUY = +qty, SELL = −qty):

1. **prev = position; next = position + signedQty**
2. **Trade start** — `prev === 0 && next !== 0` → set `direction` from first fill (BUY→LONG, SELL→SHORT), push fill.
3. **Same-direction add (scale-in)** — `sign(next) === sign(prev)` and `|next| > |prev|` → push fill.
4. **Partial close (scale-out)** — `sign(next) === sign(prev)` and `|next| < |prev|` → push fill.
5. **Full close** — `next === 0` → push fill, finalize trade, reset state.
6. **Reversal** — `prev !== 0 && sign(next) !== sign(prev) && next !== 0`:
  - Split the fill into two synthetic fills, both with the same timestamp/price:
    - **Closing portion**: `qty = |prev|`, opposite of current direction → push to current trade and finalize.
    - **Opening portion**: `qty = |next|`, defines new direction → start a new trade.

`position = next` after each step.

After processing all fills for a symbol:

- If `position !== 0` → discard `currentFills` (open position, **not imported**); count toward `rowsSkipped` only if needed for reporting (do not insert).

---

### 3. Symbol rule dependency (no auto-create)

Before constructing trades, check via `hasSymbolRule(accountId, symbol)`:

- **Has rule** → proceed; tick/contract size are read by the existing analytics layer at render time.
- **No rule** → mark symbol as missing; **drop all reconstructed trades for that symbol**; collect `{ symbol, tickSize }` (tick size from CSV `_tickSize` if present, else `0.01` for display only) in `missingSymbols`.

Strict: never call `addTickPipRule`, never set a fallback contract size on the trade itself.

---

### 4. Trade object construction

For each finalized trade:

```ts
{
  symbol,
  side: 'LONG' | 'SHORT',
  entries: fills.map(f => ({
    id: crypto.randomUUID(),
    type: f.side === 'B' ? 'BUY' : 'SELL',
    datetime: f.iso,
    quantity: f.qty,
    price: f.price,
    charges: f.commission ?? 0,
  })),
  accountId,
  tags: [], notes: '',
  tradeRisk: 0, tradeTarget: 0,
  accountBalanceSnapshot,
  // PnL computed by calculateTradeMetrics using rule-based contractSize at render time.
  // Do NOT set manualGrossPnl, do NOT set contractSize on the trade.
  preMfeTickPip: null, preMaeTickPip: null,
  source: 'imported',
}
```

Then set `trade.fingerprint = buildFingerprintForTrade(trade, 'imported')`.

Note: existing `Trade.contractSize` is used by `calculateTradeMetrics`. Since rules now drive analytics, leave `contractSize` undefined on the trade so the rule-based lookup (existing system) is the source of truth. (Confirmed by current architecture — contract size is per-account/per-symbol via `tickPipRules`.)

---

### 5. Deduplication

```ts
const seen = new Set(existingFingerprints);
for (const t of trades) {
  if (!t.fingerprint || seen.has(t.fingerprint)) { duplicatesSkipped++; continue; }
  seen.add(t.fingerprint);
  toInsert.push(t);
}
```

Fingerprints are generated **before** dedup; dedup runs **before** insertion. Never recompute for comparison.

---

### 6. Insertion

Only after dedup AND after confirming `missingSymbols.length === 0` for inserted trades' symbols:

```ts
if (toInsert.length > 0) bulkAddTrades(toInsert);
```

(Trades whose symbols are in `missingSymbols` are already excluded upstream.)

---

### 7. UI: Missing-symbols modal

**New component**: `src/components/settings/MissingSymbolRulesModal.tsx`

Props: `open`, `onOpenChange`, `accountId`, `missing: { symbol, tickSize }[]`

Layout:

- Title: **"Symbol Configuration Required"**
- Body: "Unable to import trades for the following symbols because PnL cannot be calculated without contract size."
- Table: `Symbol | Tick Size`
- Footer:
  - Primary: **"Configure Symbol Rules"** → `navigate('/settings/symbol-tick-pip')` (verify exact route during implementation by checking `SettingsSidebar`/`Settings.tsx`)
  - Secondary: **"Close"** → just close

---

### 8. Wire up `AccountImportModal.tsx`

In the existing `handleSave` switch:

- Remove the `TradovateFills` "not yet implemented" guard.
- Add a branch:
  ```ts
  if (importSource === 'TradovateFills') {
    const result = await importTradovateFills(
      selectedFile, selectedAccountId, accountBalanceSnapshot,
      bulkAddTrades, existingFingerprints,
      (accId, sym) => tickPipRules.some(r => r.accountIds.includes(accId) && r.symbol === sym),
    );

    if (result.missingSymbols.length > 0) {
      setMissingSymbolsState({ open: true, items: result.missingSymbols });
    }
    // toast: imported / duplicates / skipped, like existing branches
  }
  ```
- Render `<MissingSymbolRulesModal />` alongside the existing dialog.
- Keep behavior: if some symbols have rules and others don't, import the configured ones AND show the popup for the rest.

---

### 9. Strict guarantees (acceptance)

- ✅ Header detection ignores plain `Timestamp`; uses `_timestamp` only.
- ✅ No locale-dependent date parsing.
- ✅ Reversal fills are split into close + open trades.
- ✅ Open positions (non-zero net at end) are never inserted.
- ✅ Symbol rules must pre-exist; missing symbols → popup, no silent fallback, no auto-create.
- ✅ Fingerprint generated once, used for dedup against stored fingerprints + intra-file.
- ✅ Re-importing the same file inserts 0 new trades.
- ✅ MT5 and Tradovate Positions paths untouched.

---

### Files to add / edit

**New**

- `src/lib/tradovateFillsImport.ts`
- `src/components/settings/MissingSymbolRulesModal.tsx`

**Edited**

- `src/components/settings/AccountImportModal.tsx` — add Fills branch, mount modal.

&nbsp;

-----------------------------------

COMMISSION VALIDATION

-----------------------------------

If commission is missing or invalid:

- default to 0

Ensure commission is always a finite number.