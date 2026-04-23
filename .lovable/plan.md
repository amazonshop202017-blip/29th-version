## Add post-exit tick/pip calculations (`postMaxTickPip`, `postMinTickPip`)

Mirror the existing `preMfeTickPip` / `preMaeTickPip` logic for the new post-exit price fields. Data-only — no UI changes.

### 1. `src/types/trade.ts`

Add two optional fields to the `Trade` interface, next to the existing `postMaxPrice` / `postMinPrice`:

```ts
postMaxTickPip?: number | null;
postMinTickPip?: number | null;
```

### 2. `src/components/trades/TradeModal.tsx`

**a.** In the initial `tradeData` object (around lines 595–600), seed both fields to `null` (or carry over from `editingTrade`), matching the pattern used for `preMfeTickPip` / `preMaeTickPip`:

```ts
postMaxTickPip: editingTrade ? editingTrade.postMaxTickPip ?? null : null,
postMinTickPip: editingTrade ? editingTrade.postMinTickPip ?? null : null,
```

**b.** Inside the existing auto-calculation block (lines 603–633), after the MAE branch, append two analogous branches that reuse the already-computed `tickSize`, `ep`, `direction`, and `canCompute`:

```ts
const pMax = afterExitHighest !== '' ? parseFloat(afterExitHighest) : NaN;
const pMin = afterExitLowest  !== '' ? parseFloat(afterExitLowest)  : NaN;

// POST MAX — favorable after exit
if (canCompute && !isNaN(pMax)) {
  const ticks = direction === 'LONG'
    ? (pMax - ep) / tickSize
    : (ep - pMax) / tickSize;
  tradeData.postMaxTickPip = Math.max(0, Math.floor(ticks));
} else {
  tradeData.postMaxTickPip = null;
}

// POST MIN — adverse after exit
if (canCompute && !isNaN(pMin)) {
  const ticks = direction === 'LONG'
    ? (ep - pMin) / tickSize
    : (pMin - ep) / tickSize;
  tradeData.postMinTickPip = Math.max(0, Math.floor(ticks));
} else {
  tradeData.postMinTickPip = null;
}
```

### Behavior guarantees

- `postMaxPrice` null/empty → `postMaxTickPip = null` (same for min).
- Invalid `entryPrice` or `tickSize <= 0` → both fields `null` (`canCompute` gate).
- Negative results clamped to `0` via `Math.max(0, Math.floor(...))`.
- Direction-aware exactly like pre-exit logic.

### Out of scope

- No UI surfaces (table columns, inputs, settings) for the new tick/pip values.
- No changes to `calculateTradeMetrics`.
- No MT5 import auto-calc — imported trades keep these as `null`.
- No migration needed; missing fields read as `undefined` and are recomputed/written on next save.

## RECOMPUTATION RULE

- If entryPrice, direction, or tickSize changes:  
→ postMaxTickPip and postMinTickPip must be recomputed on next save
- Never persist stale values if inputs change