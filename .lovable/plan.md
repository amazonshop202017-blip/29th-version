

## Plan: Preserve +/- coloring for Return ($) and other P&L metrics in multi-metric mode

### Problem
When a user adds a 2nd or 3rd metric, the chart switches to the "multi-metric" code path. In that path each `<Bar>` is rendered with a single flat `fill={color}` (default `hsl(var(--chart-1))` blue). This loses the green/red profit/loss coloring that the single-metric path applies via `<Cell>` per data point — even when the user never customized the color.

The single-metric path already has the correct logic:
```ts
if (isPnlMetric) fillColor = getFill(entry.displayValue >= 0)        // +/- coloring
else if (config.color !== DEFAULT_METRIC_COLORS[0]) fillColor = ...   // user's custom color
```
We need the same logic in the multi-metric path, applied per-Bar.

### Affected files (5 charts)
1. `src/components/chartroom/PerformanceByTimeChart.tsx` (Performance by Time)
2. `src/components/chartroom/InstrumentPerformanceChart.tsx` (Performance by Symbol)
3. `src/components/chartroom/SetupPerformanceChart.tsx` (Performance by Setup)
4. `src/components/chartroom/TagsCommentsChart.tsx` (Tags & Comments)
5. `src/components/chartroom/PerformanceByDurationCompareChart.tsx` (Holding Time — comparison charts)

### Fix per file
In each file's multi-metric `<Bar>` render (the one inside `selectedMetrics.map(...)`), replace the flat-color `<Bar>` with a `<Bar>` that contains `<Cell>` children when the metric is a "P&L metric" AND the color is still the default for that index.

Reuse the existing `isPnlMetric` predicate already defined for the single-metric path:
```
['dollar','percent','avg_win','avg_loss','largest_win','largest_loss',
 'trade_expectancy','avg_net_trade_pnl','avg_daily_drawdown','largest_daily_loss',
 'avg_realized_r','avg_planned_r']
```

Pseudo-code for the multi-metric Bar (applied in all 5 files):
```tsx
const color = getMetricColor(index);
const isPnlMetric = PNL_METRICS.includes(metric);
const isDefaultColor = color === DEFAULT_METRIC_COLORS[index];
const useSplitColors = isPnlMetric && isDefaultColor;

return useSplitColors ? (
  <Bar key={...} yAxisId={`y-${index}`} dataKey={`metric_${index}`} radius={[4,4,0,0]} maxBarSize={...}>
    {chartData.map((entry, i) => (
      <Cell key={i} fill={getFill(entry[`metric_${index}`] >= 0)} />
    ))}
  </Bar>
) : (
  <Bar key={...} yAxisId={`y-${index}`} dataKey={`metric_${index}`} fill={color} radius={[4,4,0,0]} maxBarSize={...} />
);
```

The data array used by `<Cell>` mapping is the same `multiMetricChartData` already passed to the `<ComposedChart>`. The lookup `entry[\`metric_${index}\`]` reads the value for that specific metric series.

### Behavior result
- **Return ($)** as 1st, 2nd, or 3rd metric → still shows green up bars / red down bars by default
- **Return (%), Avg Win, Avg Loss, Largest Win, Largest Loss, Trade Expectancy, Avg Net P&L, Avg Daily DD, Largest Daily Loss, Avg Realized R, Avg Planned R** → same treatment (already classified as P&L metrics in the existing single-metric code)
- The moment the user opens the **Chart Display Settings** popover and picks a custom color for a P&L metric, `color !== DEFAULT_METRIC_COLORS[index]` becomes true and we switch to the flat custom color — exactly as requested
- Line type unchanged (lines stay as a single stroke color — splitting a continuous line per segment isn't meaningful and matches industry convention)
- Non-P&L metrics (winrate, tradecount, hold time, etc.) unchanged — they keep using the assigned palette color in multi-metric mode

### Out of scope (not changed)
- Single-metric rendering paths (already correct)
- Metric calculation logic
- Tooltip rendering
- Y-axis label/tick colors (already use the metric's `getMetricColor`)
- Legend swatches (already use `getMetricColor`)

