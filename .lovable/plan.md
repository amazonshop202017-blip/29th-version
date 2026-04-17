## Plan: Add Two Comparison Charts to Holding Time Page

### Goal

Add 2 side-by-side comparison charts above the existing "Performance By Trade Duration" section on the Holding Time page. They mirror the Performance by Time chart system, but the X-axis groups trades by **Holding Duration buckets** instead of timestamp buckets.

### Approach

Create a new reusable component `PerformanceByDurationChart.tsx` that mirrors `PerformanceByTimeChart.tsx` 1-to-1. Same metric system, same dropdown ("Add Metric", up to 3), same column/line toggle, same color customization, same legend/responsiveness. The ONLY change is bucketing logic and the period selector.

### What changes

**1. New component:** `src/components/chartroom/PerformanceByDurationChart.tsx`

- Same UI shell, dropdowns, settings popover, multi-metric (max 3), column/line toggle, per-metric colors, legend
- Reuses the SAME metric calculations (`getMetricValue`, `calculateTradingActivityStatsFromCounts`, `calculateRiskDrawdownStats`, `classifyTradeOutcome`, `calculateTradeMetrics`) — no metric formulas changed
- Replaces `dateSetting` (Entry/Exit) dropdown — not relevant for duration
- Replaces `period` (weekday/month/hour/etc.) with **Bucket Size** dropdown driven by trade duration

**2. Bucket Size options (period control)**


| Option         | Buckets generated                                                    |
| -------------- | -------------------------------------------------------------------- |
| 5 min          | 0–5m, 5–10m, 10–15m, …, up to max trade duration                     |
| 15 min         | 0–15m, 15–30m, …                                                     |
| 30 min         | 0–30m, 30m–1h, …                                                     |
| 1 hour         | 0–1h, 1–2h, 2–3h, …                                                  |
| 2 hour         | 0–2h, 2–4h, …                                                        |
| 4 hour         | 0–4h, 4–8h, …                                                        |
| 1 day          | 0–1d, 1–2d, …                                                        |
| Default preset | Mixed buckets matching existing `DURATION_BUCKETS` (0s–15s … 4h–24h) |


X-axis label format auto-derived: minutes shown as `Xm–Ym`, hours as `Xh–Yh`, days as `Xd–Yd`. Bucket sortOrder = bucket lower bound for natural ordering.

**3. Bucketing logic**

- For each closed trade, compute `metrics.durationMinutes`
- Assign to a bucket whose `[min, max)` range contains the duration
- Group all metrics (PnL, win/loss, R, profit factor, expectancy, etc.) per bucket — identical aggregation pipeline as Performance by Time
- "Trading activity per day" stats are kept (still use calendar day inside each duration bucket) so all metric options keep working

**4. Page integration:** edit `src/pages/chartroom/HoldingTime.tsx`

- Insert a new row above the existing `<PerformanceByDurationChart />` (the legacy bucket bar chart):

```text
[ DurationCompareChart 1 ]   [ DurationCompareChart 2 ]   <- NEW
[ Performance By Trade Duration ]                          (existing)
[ TradeCount | WinRate ]                                   (existing)
```

- Use the same `grid grid-cols-1 lg:grid-cols-2 gap-4` pattern already used on the page
- Left chart defaults to `dollar` with `useGlobalDefault=true`; right chart defaults to `winrate` with `useGlobalDefault=false` (matching Performance by Time)

### What stays untouched

- Existing scatter chart, metrics cards, and the three legacy bucket charts (`PerformanceByDurationChart`, `TradeCountByDurationChart`, `WinRateByDurationChart`) — no edits
- `PerformanceByTimeChart.tsx` — not modified
- All metric formulas in `tradingActivityStats`, `riskDrawdownStats`, `calculateTradeMetrics` — reused as-is

### Naming conflict note

The existing legacy bar chart is exported as `PerformanceByDurationChart` from `TradeDurationBucketCharts.tsx`. The new comparison component will be named `**PerformanceByDurationCompareChart**` to avoid the collision.

### Files

- **Create:** `src/components/chartroom/PerformanceByDurationCompareChart.tsx`
- **Edit:** `src/pages/chartroom/HoldingTime.tsx` (add the 2-column row above the existing duration chart)
  &nbsp;