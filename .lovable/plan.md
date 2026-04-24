# Tradovate Positions Import Pipeline

Build a Tradovate CSV import that mirrors the MT5 architecture exactly: name-based header detection, timestamp-driven direction, deterministic fingerprints, and idempotent dedup before insert.

## New file: `src/lib/tradovateImport.ts`

Exports:

- `TradovateImportResult` — same shape as `MT5ImportResult` (`success`, `tradesImported`, `duplicatesSkipped`, `rowsSkipped`, `errors`, `importedSymbols`).
- `parseTradovateCSVToTrades(csv, accountId, accountBalanceSnapshot, contractSizes?)` — pure parser returning `{ trades, skipped }`.
- `importTradovateTrades(file, accountId, accountBalanceSnapshot, bulkAddTrades, contractSizes?, existingFingerprints?)` — orchestrator (matches `importMT5Trades` signature).

### Pipeline stages

**1. Header detection (by NAME, order-agnostic)**
Required headers (case-insensitive, whitespace-trimmed):
`Product`, `Bought`, `Sold`, `Avg. Buy`, `Avg. Sell`, `P/L`, `Bought Timestamp`, `Sold Timestamp`.
Scan rows top-down using a `findHeaderRowIndex` style matcher (must contain `product` and both timestamp headers). Throw `Missing required columns: ...` if any are absent.

**2. Row extraction**
Pull each field by header index (never by position). Strip surrounding quotes. Use existing `parseCSVLine` style parser (copied locally to keep modules independent, like mt5Import does).

**3. Basic validation — skip row if any of:**
`buyQty == 0`, `sellQty == 0`, missing/invalid `buyTimeRaw`, `sellTimeRaw`, `avgBuy`, `avgSell`, `pnl`. Increment `skipped`.

**4. Quantity normalization**
`quantity = Math.min(buyQty, sellQty)` (closed portion only).

**5. Timestamp parsing** — `MM/DD/YYYY HH:mm:ss`
Custom parser (do not rely on `new Date()` of US-format string due to ambiguity): split on space → split date on `/` → build `YYYY-MM-DDTHH:mm:ss` and pass through `toISO()` from `@/lib/datetime`. Skip row on any parse failure.

**6. Direction (timestamp-only, source of truth)**

- `buyTime < sellTime` → `LONG` (entry=BUY@avgBuy, exit=SELL@avgSell)
- `sellTime < buyTime` → `SHORT` (entry=SELL@avgSell, exit=BUY@avgBuy)
- `buyTime === sellTime` → skip row
No other heuristic.

**7. Build entries** (two legs, `charges = 0`)

- LONG: `BUY` at entryTime, then `SELL` at exitTime
- SHORT: `SELL` at entryTime, then `BUY` at exitTime
Each: `id: crypto.randomUUID()`, `quantity`, `price`, `charges: 0`.

**8. Contract size derivation**

```
const denom = (avgSell - avgBuy) * quantity;
const cs = denom !== 0 ? Math.abs(pnl / denom) : null;
```

Used only for the per-trade `contractSize` field (fallback `contractSizes?.[symbol] ?? 1` at usage layer if `null`/non-finite).

**9. Build `TradeFormData**`

```
{ symbol, side, entries, tradeRisk: 0, tradeTarget: 0, accountId,
  tags: [], notes: '',
  manualGrossPnl: pnl,        // Tradovate P/L is already net of fees we don't have → use as gross too
  savedReturnPercent: accountBalanceSnapshot > 0 ? (pnl / accountBalanceSnapshot) * 100 : 0,
  savedRMultiple: 0,
  accountBalanceSnapshot,
  contractSize: derivedCs ?? contractSizes?.[symbol] ?? 1,
  preMfeTickPip: null, preMaeTickPip: null,
  source: 'imported' }
```

**10. Fingerprint** — generate immediately and store on the trade:

```
trade.fingerprint = buildFingerprintForTrade(trade, 'imported');
```

Uses existing `src/lib/tradeFingerprint.ts` (same fields as MT5: source, accountId, symbol, entryTime, exitTime, entryPrice, exitPrice, volume).

**11. Deduplication** (identical to MT5 path)

```
const seen = new Set(existingFingerprints);
for (const t of trades) {
  if (!t.fingerprint) { duplicatesSkipped++; continue; }
  if (seen.has(t.fingerprint)) { duplicatesSkipped++; continue; }
  seen.add(t.fingerprint); toInsert.push(t);
}
```

Handles re-imports, overlapping files, and intra-file duplicates.

**12. Insert** — `bulkAddTrades(toInsert)`. Every trade carries `source: 'imported'` and a stored `fingerprint`.

**13. Result** — `{ success, tradesImported, duplicatesSkipped, rowsSkipped, errors, importedSymbols }`.

## Wire into `AccountImportModal.tsx`

Replace the Tradovate `toast.error('not yet implemented')` branch with a real handler. Reuse the exact pattern already used for MT5:

1. Compute `accountBalanceSnapshot = getAccountBalanceBeforeTrades(selectedAccountId)`.
2. Build `existingFingerprints` from `trades` filtered by `accountId === selectedAccountId && source === 'imported' && fingerprint`.
3. Call `importTradovateTrades(selectedFile, selectedAccountId, accountBalanceSnapshot, bulkAddTrades, contractSizes, existingFingerprints)`.
4. On success: register new symbols with default contract size 1 (same loop as MT5), show toast `Imported X trades · Y duplicates skipped · Z rows skipped`, reset form, close modal.
5. Remove the "Tradovate import will be available in a future update" helper text.

Keep `acceptedFileTypes` for Tradovate as `.csv` (already in place).

## Out of scope

- No backend / DB changes.
- No MT5 logic touched.
- No new UI beyond removing the placeholder hint and enabling Save.

## Files touched

- `src/lib/tradovateImport.ts` (new)
- `src/components/settings/AccountImportModal.tsx` (Tradovate branch + remove helper text)

&nbsp;

---

## TIMESTAMP FORMAT HANDLING (CRITICAL)

Tradovate timestamps may appear in multiple formats:

- MM/DD/YYYY HH:mm:ss
- MM-DD-YYYY HH:mm

The parser MUST support BOTH formats reliably.

---

## PARSING RULE

Implement a robust parser that:

1. Detects separator (`/` or `-`)
2. Splits date and time parts safely
3. Supports:
  - HH:mm:ss
  - HH:mm (default seconds = 00)
4. Constructs ISO string manually:

```ts
YYYY-MM-DDTHH:mm:ss

```

5. Converts using existing `toISO()` utility

---

## VALIDATION

- If parsing fails → skip row
- Parsed timestamps MUST be valid ISO UTC strings

---

## STRICT GUARANTEE

- Same real-world timestamp must always produce identical ISO output
- No reliance on `new Date(rawString)` for parsing US-format timestamps
- All timestamps used in fingerprint MUST be normalized via this parser

---

## GOAL

Ensure consistent timestamp normalization across all Tradovate imports,  
preventing fingerprint mismatches and deduplication failures.

&nbsp;

conver to IST date/time in utc as we were doing elsewhere. 