## Goal

Add a "Use My Stats" toggle at the top of the Strategy Inputs panel on both **Monte Carlo** (`/tools/monte-carlo`) and **Streak Analysis** (`/tools/streak-analysis`). When enabled, inputs auto-fill from the user's actual filtered trading stats and become read-only. When disabled, the values stay (no reset) so the user can tweak them.

## Behavior

**Toggle ON:**
- Pulls live values from `useFilteredTradesContext` (respects all global filters: date range, accounts, symbols, etc.)
- Overwrites and continuously syncs these `SimulationParams`:
  - `winRate` ← `stats.tradeWinRate`
  - `avgWinDollar` ← `stats.avgWin`
  - `avgLossDollar` ← `Math.abs(stats.avgLoss)`
  - `riskReward` ← `avgWin / |avgLoss|` (computed)
  - `riskMode` forced to `"dollar"` (since real stats are dollar-based; % risk requires per-trade risk which isn't tracked globally)
- All affected input fields become **disabled** (greyed out, cursor-not-allowed, no focus ring)
- Risk mode segmented control (% Risk / $ Win-Loss) is also locked
- A small hint shows under the toggle: "Synced from your filtered trades"

**Toggle OFF:**
- Inputs become editable again
- Last synced values **remain** in the fields (no reset to defaults) — user can nudge them

**Untouched by the toggle:** `numberOfTrades`, `initialCapital`, `iterations` (always editable — these are pure simulation parameters, not stats).

**Empty-data guard:** If filtered stats have 0 trades or `avgLoss === 0`, show a subtle warning under the toggle ("Not enough trade data") and keep the toggle ON but leave previous values; do not divide by zero.

## UI Spec

At the top of the Strategy Inputs card, above the "Win Rate" field:

```text
┌─────────────────────────────────────┐
│  Use My Stats              [ ●——]   │   ← Switch component (shadcn)
│  Auto-fill from filtered trades     │   ← muted helper text
└─────────────────────────────────────┘
```

- Use existing shadcn `Switch` from `@/components/ui/switch` (same family as the light/dark toggle)
- Same visual block style as other input rows (rounded border, subtle bg)
- When ON: switch shows blue/active; helper text becomes "Synced from your filtered trades · Win rate, R:R, Avg Win/Loss locked"

## Technical Implementation

**Files to edit:**
1. `src/pages/tools/MonteCarlo.tsx`
2. `src/pages/tools/StreakAnalysis.tsx`

**Shared logic — extract a small hook** `src/hooks/useStatsFromTrades.ts`:
```ts
export function useStatsFromTrades() {
  const { stats } = useFilteredTrades(); // already filter-aware
  const avgLossAbs = Math.abs(stats.avgLoss);
  return {
    hasData: stats.totalTrades > 0 && avgLossAbs > 0,
    winRate: stats.tradeWinRate,
    avgWin: stats.avgWin,
    avgLoss: avgLossAbs,
    riskReward: avgLossAbs > 0 ? stats.avgWin / avgLossAbs : 0,
  };
}
```

**Per page:**
- Add `const [useMyStats, setUseMyStats] = useState(false);`
- Add `const liveStats = useStatsFromTrades();`
- `useEffect` that, while `useMyStats && liveStats.hasData`, calls `setParams` to sync the four fields + force `riskMode: "dollar"` whenever filters change
- Pass a `disabled` prop down to the affected `InputField`s and risk-mode buttons
- Extend `InputField` to accept `disabled?: boolean` → applies `disabled` on the `<input>`, `opacity-60`, `cursor-not-allowed`, and removes focus ring classes

**InputField disable styling** (added to existing component, both pages share their own copy currently — apply to both):
```tsx
<input ... disabled={disabled} className={`... ${disabled ? "cursor-not-allowed opacity-70" : ""}`} />
```

**Disabled fields when toggle ON:**
- Win Rate
- Risk-mode segmented control (% Risk / $ Win-Loss)
- Avg Win, Avg Loss inputs
- Risk Reward Ratio (hidden anyway in dollar mode, but locked if visible)

**NOT disabled:** Number of Trades, Initial Capital, Simulations.

## Edge Cases

- Filters change while toggle is ON → effect re-runs, params re-sync silently
- User toggles OFF → no `setParams` call, current values persist (already true since we just stop the sync effect)
- 0 trades after filter → toggle stays in its visual state but a warning appears; params keep their previous values
- Switching between % Risk / $ Win-Loss is blocked while ON; on toggle OFF it stays in `dollar` mode (user can switch back)

## Out of Scope

- Saving the toggle state to user preferences (session-only is fine)
- Adding a "Use My Stats" toggle to other tool pages (only Monte Carlo + Streak Analysis as requested)
