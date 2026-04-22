

## Goal

Port the Monte Carlo Simulation page and Win/Loss Streak (Losing Streak) page from the `Trade-Simulations_lovable` source project into this app, mounted at the existing sidebar routes:
- `/tools/monte-carlo` → Monte Carlo
- `/tools/streak-analysis` → Win/Loss Streak

No logic changes — keep the simulation engine, defaults, math, charts, and UI exactly as in the source.

## What to copy (1:1)

1. **`src/lib/simulation.ts`** — copied verbatim. Provides `runMonteCarlo`, `buildChartData`, `streakProbability` (already inline in the streak page), types `SimulationParams`, `SimulationResult`, `PathStats`, `RiskMode`. Pure logic, zero dependencies on the source app's framework.

2. **`src/pages/tools/MonteCarlo.tsx`** — copied from source `MonteCarloPage.tsx`. Pure component, no router calls inside (no wouter usage), so it ports cleanly with zero changes.

3. **`src/pages/tools/StreakAnalysis.tsx`** — copied from source `LosingStreakPage.tsx`. Source uses wouter's `useLocation` for a single back-button (`navigate("/")`). Two minimal adjustments (not logic changes):
   - Replace `import { useLocation } from "wouter"` with `import { useNavigate } from "react-router-dom"` and `const navigate = useNavigate()`.
   - Remove the back-arrow button in the header (this app already has a global header / sidebar for navigation; the back button would navigate to `/` which here is the dashboard, breaking UX). The rest of the header stays identical.

## Wiring

- Add two routes inside `App.tsx` (authenticated `AppLayout` `<Routes>` block, alongside the chart-room routes):
  ```
  <Route path="/tools/monte-carlo" element={<MonteCarlo />} />
  <Route path="/tools/streak-analysis" element={<StreakAnalysis />} />
  ```
- Sidebar entries already exist (verified). No sidebar changes needed.
- The pages will render inside the existing `AppLayout` (sidebar + global header), exactly like Chart Room pages.

## Styling note (no logic change)

Both source pages assume a permanent dark background (`bg-[#0a0d14]`, `text-white`, etc.) — the source app is dark-only. This app supports light + dark theme. Per the user's instruction "no change in logics and working," I will keep the dark color classes verbatim. The pages will look dark even in light mode — same as the source. If the user later wants theme integration, that's a separate task.

## File plan

```
ADD  src/lib/simulation.ts                         (verbatim copy, 190 lines)
ADD  src/pages/tools/MonteCarlo.tsx                (verbatim copy, 465 lines)
ADD  src/pages/tools/StreakAnalysis.tsx            (copy + 2 minor router adjustments, ~600 lines)
EDIT src/App.tsx                                   (add 2 imports + 2 <Route> entries)
```

## Verification after implementation

- Visit `/tools/monte-carlo` → click "Run Simulation" → equity curve + Best/Median/Worst metric cards render.
- Visit `/tools/streak-analysis` → run simulation, toggle Mathematical ↔ Simulation streak mode, verify both Loss-streak and Win-streak tables render with colored cells.
- Both pages reachable from the sidebar Tools submenu (already wired).

