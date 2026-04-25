## Add "Apply Fee Rules" toggle to the Import Trades modal

Give the user explicit control over whether per-symbol Fee Rules should drive fees during a CSV import. When the toggle is OFF, fees come from the file (or stay empty if the file has none). When ON, a matching Fee Rule wins over CSV commission — the current behaviour.

### Behaviour summary


| Import source                | Toggle OFF                                             | Toggle ON                                                                                 |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| MT5                          | CSV `Commission` column (current behaviour, unchanged) | CSV `Commission` column — MT5 has no rule integration today, so toggle is irrelevant here |
| Tradovate (Position History) | `manualFees` left empty (file has no fees)             | Matching Fee Rule applied if present, else empty                                          |
| Tradovate (Fills)            | Sum of CSV `commission` per fill                       | Matching Fee Rule applied if present, else CSV commission fallback                        |


Note: MT5 import has no Fee Rule logic today, so the toggle has no effect there. We will still show the checkbox (for consistency) but document via tooltip that it currently applies to Tradovate sources only — or we hide it for MT5. See Question below.

### UI changes — `AccountImportModal.tsx`

- Add new state `applyFeeRules: boolean` (default `false`, so existing CSV-fee behaviour stays the default and rules are explicit opt-in).
- Render a `<Checkbox>` + `<Label>` row directly **below** the Import Source combobox, labelled:
  - "Use Fee Rules to apply fees on imported trades"
  - Helper text: "When checked, matching Symbol Fee Rules override commission/fees from the file."
- Reset `applyFeeRules` to `false` whenever the modal closes / form resets / source changes (same pattern used for `selectedFile`).
- Pass `applyFeeRules` into `importTradovateFills(...)` and `importTradovateTrades(...)`.

### Library changes

`**src/lib/tradovateFillsImport.ts**`

- Add `applyFeeRules: boolean` parameter to `importTradovateFills` and thread it into `reconstructTradesFromFills`.
- Inside the per-trade `finalize()` block: only call `findMatchingFeeRule` / `calculateFeeFromRule` when `applyFeeRules === true`. When `false`, `resolvedFees = totalCommission` (the existing CSV fallback path).

`**src/lib/tradovateImport.ts**`

- Add `applyFeeRules: boolean` parameter to `importTradovateTrades` and `parseTradovateCSVToTrades`.
- Inside the per-row trade build: only run rule lookup when `applyFeeRules === true`. When `false`, `manualFees` stays `undefined` (matches the historic Tradovate Positions behaviour — no per-row fee data).

`**src/lib/mt5Import.ts**`

- No functional change required. Optionally accept and ignore `applyFeeRules` for signature symmetry. Behaviour remains: always use the CSV `Commission` column.

### Files touched

- `src/components/settings/AccountImportModal.tsx` — checkbox + state + prop wiring
- `src/lib/tradovateFillsImport.ts` — gate fee-rule logic behind flag
- `src/lib/tradovateImport.ts` — gate fee-rule logic behind flag

### Open question

Default state of the checkbox: keep it **unchecked** (rules are an explicit opt-in) — this preserves current implicit CSV behaviour for users who don't know about fee rules. I'll go with this unless you say otherwise. 