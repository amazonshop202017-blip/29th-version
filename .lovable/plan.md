## Add Stored Trade Fingerprints and Pre-Insert MT5 Deduplication

### What’s broken now

The current MT5 import path has no deduplication at all:

- `src/lib/mt5Import.ts` parses rows and sends every parsed trade straight to `bulkAddTrades(...)`
- `src/hooks/useTrades.ts` assigns only `id/createdAt/updatedAt` on insert
- `Trade` currently has no `source` or `fingerprint` fields

That is why overlapping files still insert duplicates.

### Implementation plan

1. **Add persistent trade identity fields**
  - Update `src/types/trade.ts` so every trade has:
    - `source: 'imported' | 'manual'`
    - `fingerprint: string`
  - Keep these fields persisted in local storage so they map directly to a future DB unique column.
2. **Create a single fingerprint helper**
  - Add `src/lib/tradeFingerprint.ts` with:
    - numeric normalization via `Number(n ?? 0).toFixed(5)`
    - `buildTradeFingerprint(...)`
    - helpers to extract `entryTime`, `exitTime`, `entryPrice`, `exitPrice`, and total volume from a trade’s entries
  - Final format:
    - `${source}_${accountId}_${symbol}_${entryTime}_${exitTime}_${normalize(entryPrice)}_${normalize(exitPrice)}_${normalize(volume)}`
3. **Guarantee storage safety before insert**
  - Update `src/hooks/useTrades.ts` so no trade is ever saved without both `source` and `fingerprint`.
  - Centralize creation logic for:
    - `addTrade(...)` → always stores `source: 'manual'` + fingerprint
    - `bulkAddTrades(...)` → validates incoming trades already contain source/fingerprint, or explicitly assigns them when the caller is a manual-creation flow
  - Add a one-time migration for existing local trades:
    - default legacy trades to `source: 'manual'`
    - backfill `fingerprint`
    - immediately resave migrated trades
4. **Preserve edit rules correctly**
  - In `updateTrade(...)`:
    - imported trades keep their original `source` and `fingerprint`
    - manual trades keep `source: 'manual'` and recompute fingerprint from edited values
  - In `bulkUpdateTrades(...)`:
    - keep stored `source/fingerprint` untouched unless the updated trade is manual and the changed fields affect fingerprint identity
  - Partial patch flows like tags, fees, TP/SL should not accidentally erase either field.
5. **Make MT5 import idempotent before insertion**
  - Update `src/lib/mt5Import.ts` so each parsed import trade is created with:
    - `source: 'imported'`
    - stored `fingerprint`
  - Pass in the selected account’s existing stored imported fingerprints.
  - Before calling `bulkAddTrades(...)`:
    - build a `Set` from stored fingerprints
    - skip any incoming trade whose stored fingerprint already exists
    - also add accepted incoming fingerprints to the same set so duplicates inside the same file are skipped too
  - Return:
    - `tradesImported`
    - `duplicatesSkipped`
    - `rowsSkipped`
6. **Wire the modal to the new import result**
  - Update `src/components/settings/AccountImportModal.tsx` to:
    - read existing trades from context
    - derive the selected account’s stored imported fingerprints
    - pass them into `importMT5Trades(...)`
    - show success messaging like:
      - `Imported 10 trades (50 duplicates skipped)`
      - append skipped-row info when relevant
7. **Cover existing creation paths**
  - Verify manual trade creation in `src/components/trades/TradeModal.tsx` still works with mandatory `source/fingerprint`.
  - Verify other write paths do not create trades without these fields.
  - Update duplicate-trade behavior in `src/components/trades/TradesTableCard.tsx` so duplicated trades are treated as new manual trades with fresh stored fingerprints, not copied identities.

### Files to update

- `src/types/trade.ts`
- `src/lib/tradeFingerprint.ts` (new)
- `src/hooks/useTrades.ts`
- `src/contexts/TradesContext.tsx` if typing/contracts need to expand
- `src/lib/mt5Import.ts`
- `src/components/settings/AccountImportModal.tsx`
- `src/components/trades/TradesTableCard.tsx`

### Technical details

- Deduplication will rely only on persisted `trade.fingerprint` values already stored on trades.
- Fingerprints will be created before insertion, never lazily during comparison.
- Imported trades keep stable fingerprints forever so re-importing the same trade stays idempotent.
- Manual trades remain editable by recomputing fingerprint on identity-changing edits.
- This prepares a direct future database migration:
  - `fingerprint` → `UNIQUE`
  - same fingerprint builder reused server-side
  - no logic rewrite needed later.

&nbsp;

---

## DEDUPLICATION SCOPE (CRITICAL)

- Deduplication must ONLY compare against trades where:  
source === 'imported'
- Manual trades must NOT affect import deduplication
- Build fingerprint Set as:
  existingTrades  
  .filter(t => t.source === 'imported')  
  .map(t => t.fingerprint)

---

## INSERT SAFETY GUARANTEE

- bulkAddTrades MUST ensure every trade has:
  - source
  - fingerprint
- Trades missing these fields must be:
  - rejected OR
  - explicitly assigned before insert

---

## STRICT ORDER OF OPERATIONS

1. Parse file
2. Build fingerprint for each trade
3. Compare with stored fingerprints
4. Filter duplicates
5. THEN call bulkAddTrades

Never insert first and dedupe later