# Auto-Register Symbol Tick/Pip Rules on Tradovate Import

## Goal

When importing a Tradovate (Position History) CSV, automatically create entries in **Settings → Symbol Tick/Pip & Contract Size** for every unique symbol in the file — scoped to the importing account. Trades are only inserted **after** all symbol rules are guaranteed to exist.

## Behavior

For each unique symbol in the CSV:

1. Read **tick size** from the CSV's `_tickSize` column (fallback: `0.01` if missing/invalid).
2. Compute **contract size** the same way it's already derived today (`|P/L ÷ ((avgSell − avgBuy) × qty)|`), fallback `1`.
3. Check if a `TickPipRule` already exists for `(accountId, symbol)`:
  - **Exists** → skip (do not modify; respects user edits).
  - **Missing** → create one rule with the derived tickSize + contractSize, scoped to the importing account only.
4. Each unique symbol is processed **once per import** (not per trade row).
5. Once all rules are in place, proceed to dedup + `bulkAddTrades`.

UI feedback: success toast adds a clause like `· N symbol rule(s) added` when any new rules were created.

## Technical Details

### 1. `src/lib/tradovateImport.ts`

**Parser changes (`parseTradovateCSVToTrades`)**

- Extend `ColumnIndexes` with optional `tickSize: number` (`-1` if missing).
- In `findColumnIndexes`, look up `_tickSize` (normalized: `_tick size` / `_ticksize` — match `_tick size` after `normalizeHeader`). Don't add to the `missing` required list — it's optional.
- Per row, parse `_tickSize` via existing `parseNumber`. If finite & `> 0`, use it; otherwise default to `0.01`.

**New return shape** — extend the parser to also return per-symbol metadata:

```ts
type SymbolMeta = { tickSize: number; contractSize: number };
return { trades, skipped, symbolMeta: Map<string, SymbolMeta> };
```

Populate `symbolMeta` once per symbol (first valid row wins; subsequent rows for the same symbol are ignored for meta purposes).

`**importTradovateTrades` signature** — add a callback to register rules so the lib stays UI-free:

```ts
export interface SymbolRuleInput { symbol: string; tickSize: number; contractSize: number; }
export type EnsureSymbolRules = (rules: SymbolRuleInput[]) => { added: number };

importTradovateTrades(
  file, accountId, accountBalanceSnapshot, bulkAddTrades,
  contractSizes, existingFingerprints,
  ensureSymbolRules: EnsureSymbolRules           // NEW
)
```

**Order of operations inside `importTradovateTrades**` (strict):

1. Parse CSV → trades + `symbolMeta`.
2. Run dedup (existing logic) to determine `toInsert`.
3. Build the unique-symbol list from `toInsert` (so we don't add rules for symbols whose only rows were duplicates).
4. Call `ensureSymbolRules(...)` → returns count added.
5. **Then** call `bulkAddTrades(toInsert)`.
6. Add `symbolRulesAdded: number` to `TradovateImportResult`.

### 2. `src/components/settings/AccountImportModal.tsx`

- Pull `tickPipRules` and `addTickPipRule` from `useSymbolTickSize()`.
- Define an `ensureSymbolRules` callback that:
  - For each `{ symbol, tickSize, contractSize }`, checks `tickPipRules.some(r => r.accountIds.includes(selectedAccountId) && r.symbol === symbol)`.
  - If missing → call `addTickPipRule({ accountIds: [selectedAccountId], symbol, tickSize, contractSize })`.
  - Returns `{ added }` count.
- Pass it as the new arg to `importTradovateTrades`.
- Append `· N symbol rule(s) added` to the success toast when `result.symbolRulesAdded > 0`.
- Remove the now-redundant `setContractSize` auto-registration loop for Tradovate imports (keep it for MT5 to preserve current MT5 behavior).

### 3. No changes required

- `SymbolTickSizeContext` — already exposes `addTickPipRule` and `tickPipRules`.
- `Trade` type, fingerprinting, dedup logic — untouched.
- MT5 import — untouched.

## Edge Cases

- `_tickSize` column missing entirely → default `0.01` for every new rule.
- `_tickSize` present but blank/invalid for a row → default `0.01`.
- Symbol appears in CSV but every row is a duplicate → no rule added (avoids polluting Settings on repeat imports).
- Account already has a rule for the symbol (even with different values) → leave untouched.
- Multi-symbol import → all unique-symbol rules created in one batch before any trades insert.

## Acceptance

- First Tradovate import for a new account creates one `TickPipRule` per unique symbol, visible immediately in Settings → Symbol Tick/Pip.
- Re-importing the same CSV adds zero rules and zero trades.
- Importing a different CSV with overlapping symbols adds rules only for the new symbols.
- User-edited tick/contract values are never overwritten by a subsequent import..

&nbsp;

chat gpt suggested these fixes: please make sure if they are correct suggestions, if they are then implement them : 

---

## SYMBOL EXTRACTION SOURCE (CRITICAL FIX)

Symbol rules must be derived from ALL parsed symbols,  
not only from deduplicated trades (`toInsert`).

Use:

- symbolMeta (from parser)

NOT:

- toInsert

---

## WHY

If all trades for a symbol are duplicates:

→ symbol would be skipped incorrectly

But rules must still be created for that symbol.

---

## RULE

Symbol registration must reflect CSV content,  
not deduplication result.