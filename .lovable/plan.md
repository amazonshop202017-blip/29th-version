## Goal

The Profit Target reference line already exists on the Account Balance Over Time chart (lines 443–450 of `RealPropFirmAccountDetails.tsx`), but it has two problems:

1. The **tooltip does not show the Profit Target value** on hover.
2. The **label is poorly positioned** (`position: "right"` clips outside the plot area on most viewports).

The math itself is already correct and reuses `resolveTargetAmount` from `@/lib/propFirmStats` — the same helper that drives the "Path to funding" side panel and account card progress %. No duplication is needed.

## Plan

### 1. Inject `profitTarget` into chart data points

In the `balanceSeries` useMemo (line 220), add a `profitTarget: number | null` field to every point, set to `profitTargetLine` (computed below). This makes the value available to Recharts' tooltip payload.

Move the `profitTargetLine` calculation (currently at line 337) **above** `balanceSeries` so it can be referenced inside the memo, and add it to the dependency array.

### 2. Update `CustomTooltip`

Extend `CustomTooltip` (line 26) to look for `profitTarget` in the payload and render a third row when present:

```
● Profit Target:  $X,XXX.XX
```

Use green dot color `hsl(145,60%,50%)` to match the reference line.

### 3. Improve the ReferenceLine label

Change the label config so it stays inside the plot:

- `position: "insideTopRight"`
- Slightly bolder fill, same green hue
- Keep dashed stroke (`5 4`), color `hsl(145,60%,50%)`

### 4. Confirm dynamic updates

`profitTargetLine` already depends on `selectedRules`, which depends on `accountTab` — switching STEP 1 ↔ STEP 2 ↔ FUNDING already re-renders the line correctly (FUNDING phase hides it, by design). No additional wiring needed.

### Why no logic duplication

- Profit target amount = `resolveTargetAmount(step.profitTarget, challenge.balanceAmount)` — identical helper used by `computeAccountStats` and `accountToRow`.
- Target balance for the chart line = `account.startingBalance + profitTargetAmount` — same reference frame the side panel uses (`pnl` vs `profitTarget`).

## Files changed

```
EDIT  src/components/propfirm/RealPropFirmAccountDetails.tsx
        - Move profitTargetLine calc above balanceSeries memo
        - Add profitTarget field to each balanceSeries point
        - Extend CustomTooltip to render Profit Target row
        - Adjust ReferenceLine label position to insideTopRight
```

No new files, no new helpers, no changes to `propFirmStats.ts` or `ChallengesContext.tsx`.

## Verification

1. Open a prop firm account on STEP 1 with a profit target → green dashed line visible across the chart, label "Profit Target" inside top-right.
2. Hover any point → tooltip shows Balance, Minimum Balance (if present), and **Profit Target** with the same dollar value as the side panel's "Target: $X" row.
3. Switch tab STEP 1 → STEP 2 → line moves to the new step's target.
4. Switch to FUNDING tab → line disappears (no profit target in funded phase, by design).
5. Confirm the chart's profit target dollar amount equals `startingBalance + (Path to funding → Target row)`.

&nbsp;

---

## SAFETY & EDGE CASE HANDLING

- Only render Profit Target when `profitTargetLine` is a valid number  
(skip for funded phase or missing rules)
- Ensure chart Y-axis domain includes `profitTargetLine`  
so the green line is always visible within the chart bounds
- Tooltip must safely handle missing values  
(do not render Profit Target row if value is null)

---

## CONSISTENCY GUARANTEE

- Profit Target MUST use the same calculation source as:
  - account card progress %
  - "Path to funding" target value
- Do NOT introduce any new calculation logic  
→ reuse `resolveTargetAmount` only

---

## VALIDATION

After implementation, verify:

1. Profit Target line is visible and correctly positioned within chart bounds
2. Tooltip shows Profit Target value on hover
3. Value matches exactly with "Path to funding → Target"
4. Line updates correctly when switching STEP 1 ↔ STEP 2
5. Line is hidden in FUNDED phase