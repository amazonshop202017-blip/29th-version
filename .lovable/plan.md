## Add "Realized RR vs Max Available RR" KPI Card

Add a new KPI card below the existing Performance Comparison chart on `/chart-room/trade-management`, reusing the same per-trade `actualR` and `potentialR` (MFE-based) values already computed in the chart pipeline.

### Where it goes

`src/pages/chartroom/TradeManagement.tsx` — render a new `<Card>` directly below the existing summary grid, inside the same root `<div className="space-y-6">`.

### Data reuse (no new formulas)

The existing `useMemo` already produces a `data` array with:

- `actualR` — `trade.savedRMultiple`
- `potentialR` — MFE-based R (or `null` when MFE data missing, or `-1` when SL hit first)
- entries are already sorted by `openDate` ASC

For the new KPI we will:

1. From the same `chartData.data`, take only rows where `potentialR !== null` (this enforces the "MFE data exists" rule — `preMfePrice` is the gate inside the existing logic).
2. Map each row to:
  - `realizedR = actualR`
  - `maxR = potentialR`
  - `captureRate = maxR <= 0 ? 0 : clamp(realizedR / maxR, 0, 1)`
  - `symbol` — read from `trade.symbol` (need to keep the source `Trade` reference; we'll extend the existing `ChartDataPoint` to carry `symbol` so we don't recompute or re-lookup).
3. Take the **last 10–15** entries (slice `-12`) for the bar list — display in the same ASC order shown in reference.
4. Aggregates over the **filtered (eligible) full set**, not just the visible 12:
  - `avgRealized = mean(realizedR)`
  - `avgMax = mean(maxR)`
  - `avgCapture = mean(captureRate)` shown as %.

### Card layout (matches reference image)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Realized RR vs Max Available RR                                │
│  Trade-level capture efficiency                                 │
│                                                                 │
│  1  MCLH6   [████████████▒▒▒▒▒▒░░░░░░░░░░]   +1.49R   83.2%    │
│  2  MCLJ6   [▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░]    -1R       0%    │
│  …                                                              │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│        AVG REALIZED        AVG MAX         CAPTURE              │
│         -0.04R              0.37R            6%                 │
└─────────────────────────────────────────────────────────────────┘
```

Row anatomy (left → right):

- **Index** (muted, fixed width ~`w-6`)
- **Symbol** (muted, fixed width ~`w-20`, truncate)
- **Bar track** (flex-1, h-6, `bg-muted`, rounded):
  - Inner container width is normalized to the **largest `maxR` in the visible set** so bars are visually comparable (full track = `globalMaxR`).
  - **Filled portion**: width = `(|realizedR| / globalMaxR) * 100%`, only drawn when `realizedR > 0` (green = `bg-green-500`) or `realizedR < 0` (red = `bg-red-500`). When `realizedR <= 0` the filled segment uses red and is anchored at the left of the bar (no negative offset; matches reference behavior of "−1R" rows that show no green/red fill but striped only — see note).
  - **Striped portion**: starts at end of filled, ends at `maxR / globalMaxR`. Uses a diagonal stripe pattern via Tailwind arbitrary value: `bg-[repeating-linear-gradient(45deg,_hsl(var(--muted-foreground)/0.35)_0_4px,_transparent_4px_8px)]`.
  - **Empty trailing**: remainder of track stays `bg-muted`.
- **Realized value** (right-aligned, `w-16`): `+1.49R` / `-1R` / `+0R`. Sign-prefixed; color neutral (muted-foreground) like reference.
- **Capture %** (right-aligned, `w-14`): green when > 0, muted/red-ish when 0% (reference shows red `0%`). Use `text-green-600` for >0, `text-red-500` for 0.

Reference behavior nuance for losing trades: in the screenshot the row with `-1R` shows **no green fill, only striped** — that means when `realizedR <= 0`, we draw **no filled segment** and the entire `maxR` track is striped. We'll match that:

```
if realizedR > 0:  [green filled to realizedR][striped to maxR][empty]
else:              [striped to maxR][empty]
```

### Bottom summary

Three columns separated by a top border, centered:

- `AVG REALIZED` — `avgRealized.toFixed(2)R`, colored green/red by sign
- `AVG MAX` — `avgMax.toFixed(2)R`
- `CAPTURE` — `(avgCapture * 100).toFixed(0)%`, colored green/red

Labels in `text-xs uppercase tracking-wide text-muted-foreground`, values in `text-lg font-semibold`.

### Empty state

If no trades have MFE data after filtering, render a compact muted message: "No trades with MFE data available." Keep card visible.

### Technical notes

- Pure presentational addition — no new hooks, no new files needed (single inline subcomponent inside `TradeManagement.tsx` is fine; if it grows, extract to `src/components/chartroom/CaptureRateCard.tsx`).
- Extend the existing `ChartDataPoint` type with `symbol?: string` and populate it inside the existing `.map` — zero extra iteration cost, zero recomputation.
- All colors via existing Tailwind tokens (`bg-muted`, `bg-green-500`, `bg-red-500`, `text-muted-foreground`, `border-border`) so it adapts to the project's light/dark theme.
- Width normalization uses the visible set's max `maxR` (fallback to `1` when all are ≤ 0) to keep proportions readable; this is a display-only normalization, not a calculation change.

### Acceptance check

- Bars visible only for trades with MFE data (`potentialR !== null` from the existing pipeline).
- Numbers tie out exactly with the chart's dotted "Potential Performance" line (same per-trade values).
- Last 10–15 trades shown, ASC by open date.
- Aggregates computed across the full eligible set.
- Card sits directly under the existing summary metric row, full container width, same `<Card>` styling.

## ⚠️ 1. Add tooltip on bars (VERY IMPORTANT UX)

Right now user sees:

```

```

```
bar + numbers
```

👉 But they won’t fully understand trade details.

---

### ✍️ Add:

```

```

```
On hover show:

Symbol
Realized: +1.49R
Max: 1.8R
Capture: 83%
```

---

👉 This makes it **interactive + educational**