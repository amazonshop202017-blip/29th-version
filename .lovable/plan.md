

## Add Execution vs Opportunity Mode to Opportunity Analysis

Introduce a global `analysisMode` toggle (`execution` | `opportunity`) that controls whether the analyzer reads pre-exit MFE/MAE ticks or post-exit Max/Min ticks. Logic centralized in `prepareExitTrades()`; UI components stay mode-agnostic.

### 1. Data layer — `src/lib/exitAnalyzerCalc.ts`

Extend `prepareExitTrades` signature:

```ts
export type AnalysisMode = 'execution' | 'opportunity';

export function prepareExitTrades(
  trades: Trade[],
  treatMissingAsZero: boolean,
  mode: AnalysisMode = 'execution'
): ExitAnalyzerTrade[]
```

Inside the loop, pick source fields by mode:

- `execution` → `mfe = trade.preMfeTickPip`, `mae = trade.preMaeTickPip`
- `opportunity` → `mfe = trade.postMaxTickPip ?? null`, `mae = trade.postMinTickPip ?? null`

Apply identical missing-data rules to both modes:
- both missing → skip
- both present → include
- one missing + `treatMissingAsZero` → fill 0
- one missing + flag off → skip

`realizedR` calculation is unchanged (always derived from actual trade outcome via `savedRMultiple` or `netPnl / tradeRisk`). It does NOT depend on mode.

No changes to `simulateExit`, `computeHeatmap`, `computeSLSweep`, `computeTPSweep` — they consume the prepared dataset only.

### 2. UI — `src/pages/edgelab/OpportunityAnalysis.tsx`

**a. Add state at the parent component level:**
```ts
const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('execution');
```
This state lives in the parent so it persists across Auto ↔ Manual tab switches.

**b. Lift `treatMissingAsZero` & `minTradeCount` to parent** (currently duplicated in `ManualExitTab`) so both tabs share the prepared dataset and toggle. Pass `analysisMode`, `treatMissingAsZero`, `minTradeCount` (and their setters) into `ManualExitTab` via props.

**c. New mode toggle row** rendered just below the Auto/Manual sub-tabs (above the methodology card):

```
Analysis Mode:  [ Execution ]  [ Opportunity ]
                  (default)
```
- Pill-style segmented control matching the existing "Coloring" / "Optimise" toggles.
- Small info tooltip: "Execution = movement before exit · Opportunity = full movement after exit."

**d. Update memoization** in both Auto view and `ManualExitTab`:
```ts
const exitTrades = useMemo(
  () => prepareExitTrades(filteredTrades, treatMissingAsZero, analysisMode),
  [filteredTrades, treatMissingAsZero, analysisMode]
);
```

**e. Mode-aware labels** (single source: derive a `labels` object from `analysisMode`):
- Scatter chart title:
  - execution → "MFE / MAE Scatter"
  - opportunity → "Post-Exit Max / Min Scatter"
- Scatter axis labels:
  - execution → `MAE (ticks)` / `MFE (ticks)`
  - opportunity → `Post Min (ticks)` / `Post Max (ticks)`
- Scatter "TP hit" / "SL hit" counters keep working (they read `mfe`/`mae` from the prepared data, which now point to the correct source).
- Empty state copy:
  - execution → "No trades with MFE/MAE data available."
  - opportunity → "No trades with post-exit Max/Min data available."

**f. Updated methodology card** (top of page):
- Headline (mode-aware):
  - execution → "Based on price movement **before exit** (MFE/MAE)."
  - opportunity → "Based on full price movement **after exit** (Post Max/Min). Results may appear more optimistic — this is expected."
- Persistent sub-line under both modes:
  *"This analysis is based on price ranges and does not consider the order of movement."*

### 3. Behavior guarantees

- Default mode = `execution` → existing heatmap, sweeps, scatter, quick calculator outputs are byte-identical to current behavior.
- Mode persists when switching Auto ↔ Manual.
- No fallback between datasets: opportunity mode never reads pre-exit fields; execution mode never reads post-exit fields.
- `realizedR` is always the real outcome — identical across modes.
- All downstream computations (heatmap, sweeps, quick calc, scatter) consume only the output of `prepareExitTrades` — no mode branching in chart/table code.
- Memoization keys include `analysisMode`, preventing stale recomputes.

### 4. Out of scope

- No new fields on `Trade`.
- No changes to Exit Analysis page.
- No MT5 import auto-calc.
- No persistence of selected mode across page reloads (session-only state).

### Files touched

- `src/lib/exitAnalyzerCalc.ts` — add `mode` param + `AnalysisMode` type.
- `src/pages/edgelab/OpportunityAnalysis.tsx` — add toggle, lift shared state, mode-aware labels, methodology copy, propagate `mode` into `prepareExitTrades` calls.

