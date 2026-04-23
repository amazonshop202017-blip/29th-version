## Rename: Advanced Data field variables (MFE/MAE alignment)

Rename internal variable/property names to match the new MFE/MAE labels. Pure backend/code rename — no UI text changes.

### Rename map


| Old name                | New name        |
| ----------------------- | --------------- |
| `farthestPriceInProfit` | `preMFEprice`   |
| `farthestPriceInLoss`   | `preMAEprice`   |
| `mfeTickPip`            | `PREmfeTickPip` |
| `maeTickPip`            | `PREmaeTickPip` |


### Files to update (8)

1. `**src/types/trade.ts**` — rename the 4 fields on `Trade` interface; update the `mfeTickPip`/`maeTickPip` references in `calculateTradeMetrics`-adjacent comments.
2. `**src/components/trades/TradeModal.tsx**` — rename local state setters (`setFarthestPriceInProfit` → `setPreMFEprice`, etc.), all reads/writes from `editingTrade`, and the tick computation block writing `tradeData.PREmfeTickPip` / `PREmaeTickPip`.
3. `**src/components/trades/TradesTableCard.tsx**` — update any column/sort references.
4. `**src/hooks/useTrades.ts**` — update the migration block that normalizes `mfeTickPip`/`maeTickPip` undefined → null. Add a **localStorage migration** that copies old field names → new field names on load (so existing user data isn't lost).
5. `**src/lib/exitAnalyzerCalc.ts**` — rename `trade.mfeTickPip` / `trade.maeTickPip` reads.
6. `**src/lib/mt5Import.ts**` — rename properties set during import.
7. `**src/pages/chartroom/TradeManagement.tsx**` — rename `trade.farthestPriceInProfit` reads in the potential-R calc.
8. `**src/pages/edgelab/ExitAnalysis.tsx**` — rename references.

### Data migration (critical)

Existing users have trades in `localStorage` under `trading-journal-trades` using old field names. In `useTrades.ts` migration loop, add:

```ts
// Rename: farthestPriceInProfit → preMFEprice, etc.
if ('farthestPriceInProfit' in updated) {
  updated = { ...updated, preMFEprice: updated.farthestPriceInProfit };
  delete updated.farthestPriceInProfit;
}
// same for farthestPriceInLoss, mfeTickPip, maeTickPip
```

This runs once on next load and overwrites localStorage with the new shape.

### Out of scope

- No UI label changes (already done in prior turn).
- No database/edge function changes (project is client-side localStorage only).
- Variable names in unrelated calc functions (`mfe`/`mae` local vars in `exitAnalyzerCalc.ts`) stay — only the `trade.*` property accesses are renamed.

KEEP THIS IN MIND: 

## NAMING CONSISTENCY

- Use consistent camelCase across all fields:
  - preMfePrice
  - preMaePrice
  - preMfeTickPip
  - preMaeTickPip
- Avoid mixed casing (e.g. PREmfeTickPip)