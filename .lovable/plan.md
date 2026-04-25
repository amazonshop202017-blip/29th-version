## Remove Open-Trade Logic from Zerodha Tradebook Import

Strip open-trade support from the Zerodha import path. Closed-trade reconstruction stays exactly as it is (already mirrors the Tradovate Fills position engine). Behavior becomes identical to Tradovate Fills: any symbol whose net position never returns to zero is silently discarded.

### What the user will see

- The **"Import Open Trades"** checkbox is removed from the Import Trades modal.
- The Zerodha hint text changes to: *"Upload a Zerodha tradebook CSV export. Open positions (not fully closed) are skipped."*
- Selecting Zerodha (Tradebook) and uploading a CSV imports only fully-closed trades. Open positions are dropped without warning, matching Tradovate Fills behavior.

### Technical changes

**`src/lib/zerodhaTradebookImport.ts`**
- Remove `importOpenTrades` from `ZerodhaImportOptions` (interface now contains only `applyFeeRules`).
- Remove the `isOpen` parameter from the inner `finalize(...)` function — it always finalizes a closed trade.
- Replace the end-of-symbol open-position branch with the silent-discard form used by Tradovate Fills:
  ```ts
  if (position !== 0) {
    currentFills = [];
    direction = null;
  }
  ```
- Drop the `isOpen` argument when calling `buildFingerprintForTrade` (closed-trade fingerprint only).
- All other logic (CSV parsing, header detection, position engine, scale-in/out, reversal splitting, fee-rule resolution, dedup) is unchanged.

**`src/lib/tradeFingerprint.ts`**
- Leave the `isOpen` field in `FingerprintInput` and the `_OPEN` suffix logic in place. It is harmless when unused and keeps the door open if open-trade support is ever re-introduced. No call site in the codebase will pass `isOpen: true` after this change.
- (Optional cleanup, only if you prefer a strict revert: remove the `isOpen` field and the `if (input.isOpen) parts.push('OPEN');` line, plus the `options` parameter on `buildFingerprintForTrade`. Default plan keeps the field for forward-compatibility — confirm if you want the strict revert instead.)

**`src/components/settings/AccountImportModal.tsx`**
- Remove the `importOpenTrades` state and its reset in `resetForm`.
- Remove the entire **"Import Open Trades"** checkbox block (the conditional `{importSource === 'ZerodhaTradebook' && (...)}` section).
- Update the `importZerodhaTradebook(...)` call to pass `{ applyFeeRules }` only.
- Update the Zerodha hint text to reflect open-position skipping.

### Acceptance criteria

- The Import Trades modal shows no "Import Open Trades" checkbox for any source.
- Importing a Zerodha CSV with 5 closed + 2 open positions imports exactly **5 trades**; the 2 open positions are silently skipped (no toast, no count).
- Re-importing the same file imports 0 trades and reports the correct duplicates count.
- Fee Rules toggle continues to work for Zerodha exactly as before (ON + matching rule → rule fee applied; OFF or no rule → no fees).
- No TypeScript errors; all references to `importOpenTrades` are gone from the modal and the import module's public API.
