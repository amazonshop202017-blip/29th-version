## Add Analysis Mode (Execution vs Opportunity) to Trade Management

Extend `src/pages/chartroom/TradeManagement.tsx` so users can switch between **Execution** (pre-exit MFE) and **Opportunity** (post-exit max/min) analysis. The chart and capture-rate card must both reflect the selected mode through a single shared data pipeline.

### 1. Mode state & toggle UI

At the top of the page (above the chart card), add a segmented control:

```text
Analysis Mode:  [ Execution ]  [ Opportunity ]
```

- State: `const [analysisMode, setAnalysisMode] = useState<'execution' | 'opportunity'>('execution')`
- Built with existing `ToggleGroup` / `ToggleGroupItem` (single-select, type="single", non-deselectable).
- Tooltip via existing `Tooltip` primitive: *"Execution = before exit (MFE/MAE) · Opportunity = after exit (post max/min)"*.
- Mode persists across re-renders within the page (no filter/tab resets it).

### 2. Single source of truth — `prepareTradeManagementData`

Refactor the current `useMemo` block into one helper used for **both** the chart and the capture-rate card:

```ts
type AnalysisMode = 'execution' | 'opportunity';

function prepareTradeManagementData(trades: Trade[], mode: AnalysisMode) { ... }
```

Returns `{ data: ChartDataPoint[], hasPotentialData: boolean }` (same shape used today).

**Eligibility (shared base):** entry price, stopLoss, takeProfit, side, priceReachedFirst, position CLOSED, and a usable actualR (`savedRMultiple ?? rFactor`). Sort by openDate ascending.

**Per-trade fields:**
- `actualR` → `trade.savedRMultiple ?? metrics.rFactor` — **identical in both modes**.
- `setForgetR` → unchanged (TP→planned RR, SL→-1).
- `potentialR` → mode-dependent (see below). If unavailable for the trade in the selected mode, set `potentialR = null` and **skip** it from cumulative-potential and from capture-rate rows. Do **not** fall back to the other mode's data.

**Execution mode `potentialR` (current logic, unchanged):**
- If `priceReachedFirst === 'stopLoss'` → `-1`.
- Else if `preMfePrice` present:
  - LONG: `max(-1, (preMfePrice - entry) / (entry - sl))`
  - SHORT: `max(-1, (entry - preMfePrice) / (sl - entry))`
- Else → `null`.

**Opportunity mode `potentialR` (new):**
- LONG: requires `postMaxPrice` → `(postMaxPrice - entry) / (entry - sl)`
- SHORT: requires `postMinPrice` → `(entry - postMinPrice) / (sl - entry)`
- Risk denominator must be `> 0`; otherwise `null`.
- No `-1` floor (opportunity is post-exit only; SL outcome no longer constrains it). No clamp.
- If the required post-exit field is missing → trade is **skipped** for `potentialR` (`null`). It still contributes `actualR` and `setForgetR` to the chart, matching how execution-mode trades without `preMfePrice` are handled today.

### 3. Chart behavior (unchanged shape)

The existing line chart keeps three series:
- `cumulativeActual` — unchanged across modes.
- `cumulativeSetForget` — unchanged across modes.
- `cumulativePotential` — driven by mode-specific `potentialR`. Series is hidden when `hasPotentialData === false`.

Title/subtitle below the chart title shows a dynamic caption:
- Execution: *"Based on price movement before exit (MFE)"*
- Opportunity: *"Based on full price movement after exit"*

Append to the methodology/help text: *"This analysis is based on price ranges and does not consider order of movement."*

### 4. Capture-rate card ("Realized RR vs Max Available RR")

- Uses the **same** `chartDataArray` returned by `prepareTradeManagementData` — no separate computation.
- Title stays the same; add the same dynamic caption ("...before exit (MFE)" / "...after exit") under the title so the mode is unambiguous.
- Rows, averages, and bars automatically reflect the selected mode because they read `potentialR`/`actualR` from the shared dataset.
- Trades skipped in opportunity mode (missing `postMaxPrice`/`postMinPrice`) drop out of this card automatically — matches the "missing data → skip trade" rule.

### 5. KPI summary cards

The four summary cards (Eligible Trades, Total Actual, Total Set & Forget, Total Potential) keep reading from the same dataset. The "Total Potential (MFE)" card label becomes dynamic:
- Execution: *"Total Potential (MFE)"*
- Opportunity: *"Total Potential (Post-Exit)"*

### 6. Strict rules enforced by the design

- Mode branching exists **only** inside `prepareTradeManagementData`.
- Chart + capture card + KPIs are mode-agnostic.
- `actualR` is computed once and never differs between modes.
- No cross-mode fallback. Missing post-exit data → trade skipped from `potentialR`/capture rows in opportunity mode.

### Files to change

- `src/pages/chartroom/TradeManagement.tsx` — add mode state + toggle UI, extract `prepareTradeManagementData`, wire dynamic captions/labels, ensure capture card consumes the shared dataset.

No type changes needed: `postMaxPrice` and `postMinPrice` already exist on `Trade` (`src/types/trade.ts`). No migrations required.