

## Update MFE/MAE placeholders to suggest a rounded entry price

In the Trade Modal → Advanced → Price Movement section, replace the static `"0.00"` placeholders on the MFE and MAE inputs with a dynamic hint derived from the currently entered Entry Price (even before the trade is saved).

### Rounding rule

Mirror the examples the user gave:

| Entry price | Suggested round number |
|---|---|
| `5664` | `5660` (nearest 10) |
| `64.6` | `65` (nearest 1) |
| `1.2345` | `1.23` (nearest 0.01) |
| `0.0842` | `0.08` (nearest 0.01) |

Logic — pick the rounding step from the magnitude of the entry price:

```ts
function roundForPlaceholder(price: number): number {
  const abs = Math.abs(price);
  let step: number;
  if (abs >= 1000) step = 10;       // 5664 → 5660
  else if (abs >= 100) step = 1;    // 234.7 → 235
  else if (abs >= 10) step = 1;     // 64.6 → 65
  else if (abs >= 1) step = 0.1;    // 5.43 → 5.4
  else step = 0.01;                 // 0.084 → 0.08
  return Math.round(price / step) * step;
}
```

### Placeholder behavior

- When `entryPrice` is empty or invalid → keep current placeholder `"0.00"`.
- When `entryPrice` parses to a number → placeholder becomes `e.g. {rounded}` (e.g. `e.g. 5660`, `e.g. 65`, `e.g. 1.23`).
- Same placeholder is shown on **both** MFE and MAE inputs (both are price levels around the entry).

### File to edit (1)

**`src/components/trades/TradeModal.tsx`**

1. Add a `useMemo` near the other derived values (around line ~404) that computes the placeholder string from `entryPrice`:
   ```ts
   const mfeMaePlaceholder = useMemo(() => {
     const ep = parseFloat(entryPrice);
     if (!isFinite(ep) || ep <= 0) return '0.00';
     const rounded = roundForPlaceholder(ep);
     // Trim trailing zeros for clean display (e.g. 5.40 → 5.4, 65.00 → 65)
     return `e.g. ${parseFloat(rounded.toFixed(2)).toString()}`;
   }, [entryPrice]);
   ```
2. Define `roundForPlaceholder` as a small helper (top of file, outside component).
3. Replace `placeholder="0.00"` on the MFE input (line 1180) and the MAE input (line 1200) with `placeholder={mfeMaePlaceholder}`.

### Out of scope

- No change to validation, parsing, persisted values, or tick/pip auto-calc — placeholder is purely visual.
- No change to UI labels, tooltip, or any other field's placeholder.

