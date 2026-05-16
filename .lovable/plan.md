## Plan: Add Setup Cards Below Setups Table

Add a card grid below the existing "Your Setups" table on the Strategies page (`src/pages/Strategies.tsx`). The existing table, mobile cards, add/edit flows, and routing remain untouched.

### What each card shows (matching reference image)
- **Header row**: lightning-bolt icon (in rounded square tile), setup name (uppercase), small "LIVE" pill badge, and a `MoreVertical` (•••) button on the right
- **Sub-header**: setup type/description in muted small caps, e.g. `INTRADAY · LAST EXECUTION: <date>`
- **Two metric rows** (3 columns each):
  - Row 1: `WIN RATE`, `PF` (profit factor), `MONTHLY` (current month return %)
  - Row 2: `HISTORY` (total trades), `AVG R` (avg R multiple), `DD` (max drawdown %)
- **Mini line chart**: a smooth cumulative P&L line with a soft gradient fill underneath, full-width at the bottom of the card

Colors follow existing semantic tokens (`text-profit`, `text-loss`, `text-muted-foreground`, `glass-card`, `border-border`). Card uses the same `glass-card rounded-2xl` styling as the rest of the page so it visually matches the site.

### Layout
- New section below the existing table card, titled "Setup Overview"
- Responsive grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
- Clicking a card navigates to `/strategies/:id` (same as table row)
- `•••` menu mirrors the table's dropdown (View Details, Edit, Edit Checklist, Delete)

### Data
- Reuse `strategiesWithStats` already computed in the page
- Extend `calculateStrategyStats` (in `src/lib/strategyStats.ts`) to also return:
  - `monthlyReturnPct` — current calendar month net P&L as % of starting account balance (or simple sum % if balance unavailable; fall back to 0)
  - `avgR` — average R-multiple across closed trades (uses existing trade metrics)
  - `maxDrawdownPct` — running max drawdown over cumulative P&L
  - `cumulativeSeries: { x: number; y: number }[]` — cumulative net P&L points for the mini chart
  - `lastExecutionDate` — most recent trade exit date (ISO)
- All additions are additive; existing fields and consumers stay intact

### Chart
- Use `recharts` `AreaChart` (already used elsewhere) with a single `Area` + linear gradient defs (`hsl(var(--profit))` / `hsl(var(--loss))` depending on final P&L sign)
- No axes, no grid, no tooltip — purely decorative, ~80px tall

### Files to change
- `src/pages/Strategies.tsx` — append a new "Setup Overview" section with the card grid; add a small inline `SetupCard` component (or extract to `src/components/strategy/SetupCard.tsx` for cleanliness)
- `src/lib/strategyStats.ts` — extend `StrategyStats` interface and `calculateStrategyStats` with the new fields listed above
- New file: `src/components/strategy/SetupCard.tsx` — the card component

### Not changing
- Existing desktop table grid, mobile card layout, add-form, edit-flow, checklist editor, routing
- Any other page or context
