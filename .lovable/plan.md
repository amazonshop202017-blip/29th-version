## Goal
In the Backtesting Session page, after a trade is saved, keep certain field values in the inline entry form so the user can rapidly log similar trades. Persistence is in-memory only (cleared on tab/page change or reload).

## Scope
File: `src/pages/backtesting/BacktestSession.tsx` (inline form state `form` in `BacktestSession`).

No changes to storage, no localStorage, no changes to `AddTradeModal` (that's for editing existing rows).

## Persisted fields (by field id)
- `entryDate`
- `exitDate`
- `symbol`
- `setup`
- `qty`
- `rMultiple`

(Use the actual field ids from `backtestStore` catalog — will verify exact ids during implementation; the above are the conceptual set the user named: entry date, exit date, symbol, setup, qty, R-multiple.)

## Behavior change
Current `handleSaveTrade`:
```ts
addRow(form);
setForm({});            // clears everything
```

New `handleSaveTrade`:
```ts
addRow(form);
const PERSIST = new Set(['entryDate','exitDate','symbol','setup','qty','rMultiple']);
setForm(prev => {
  const kept: typeof prev = {};
  for (const k of Object.keys(prev)) {
    if (PERSIST.has(k)) kept[k] = prev[k];
  }
  return kept;
});
```

Only persist values for fields the user actually has configured (no-op if the field isn't present). Non-persisted fields (e.g., entry price, exit price, P/L, notes) reset to empty as before.

Because state lives in component `useState`, it naturally clears on route change, tab close, or refresh — matching the "frontend only, no localStorage" requirement.

## Out of scope
- Edit-trade modal (`AddTradeModal`) — unchanged.
- Storage layer (`useBacktestSession`, `backtestStore`) — unchanged.
- Visual design — unchanged.
