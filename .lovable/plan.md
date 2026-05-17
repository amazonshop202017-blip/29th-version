## Goal

The sidebar already lists `Risk of Ruin` (`/tools/risk-of-ruin`) and `Kelly Criterion` (`/tools/kelly-criterion`) but the routes 404. Port the two calculators verbatim from the `risk/kelly` project and mount them on those routes.

## Steps

1. **Add dependencies** (used by the source components, not currently in this project):
   - `echarts` (`^6.0.0`)
   - `echarts-for-react` (`^3.0.6`)
   
   `recharts` and `lucide-react` are already installed and compatible.

2. **Copy component files 1:1** (no edits to logic, imports, styles, or markup):
   - `risk/kelly:src/components/KellySimulator.tsx` → `src/components/tools/KellySimulator.tsx`
   - `risk/kelly:src/components/RiskToRuinSimulator.tsx` → `src/components/tools/RiskToRuinSimulator.tsx`

3. **Port styles 1:1**: append the entire contents of `risk/kelly:src/index.css` to our `src/index.css`. The class names (`.panel`, `.main-title`, `.form-input`, `.result-card`, `.app-container`, `.max-w-container`, etc.) and CSS variables (`--bg-dark`, `--accent`…) don't exist anywhere else in this codebase, so there are no collisions. The components stay visually identical (dark themed) inside their own pages.

4. **Create the two route pages** that reproduce the markup the source `App.tsx` renders for each calculator (heading + simulator), without the home/back button shell (the app already has a global header + sidebar):

   - `src/pages/tools/RiskOfRuin.tsx`
     ```tsx
     import RiskToRuinSimulator from '@/components/tools/RiskToRuinSimulator';

     export default function RiskOfRuin() {
       return (
         <div className="app-container">
           <div className="max-w-container">
             <h1 className="main-title">Risk of Ruin Calculator</h1>
             <p style={{ color: '#a0a0a0', marginBottom: '2rem' }}>
               This calculator helps traders understand the probability of losing a specific percentage of their account based on their win rate, risk/reward ratio, and position sizing strategy.
             </p>
             <RiskToRuinSimulator />
           </div>
         </div>
       );
     }
     ```

   - `src/pages/tools/KellyCriterion.tsx`
     ```tsx
     import KellySimulator from '@/components/tools/KellySimulator';

     export default function KellyCriterion() {
       return (
         <div className="app-container">
           <div className="max-w-container">
             <h1 className="main-title">Kelly Criterion Calculator</h1>
             <KellySimulator />
           </div>
         </div>
       );
     }
     ```

   These mirror the source `App.tsx` page sections exactly. (`AppLayout` already detects `/tools/*` and skips its padding wrapper, so the source's `.app-container` padding is honored.)

5. **Register routes in `src/App.tsx`** next to the existing tools routes:
   ```tsx
   <Route path="/tools/risk-of-ruin" element={<RiskOfRuin />} />
   <Route path="/tools/kelly-criterion" element={<KellyCriterion />} />
   ```
   Plus the two imports at the top.

## Out of scope

- No edits to the simulator component code itself (logic, charts, styling all stay byte-identical to the source).
- No sidebar changes — the entries and paths already match.
- No re-theming of the calculators to light mode; the source design uses its own dark palette and we are copying it as-is per the request.

## Verification

- Click `Risk of Ruin` and `Kelly Criterion` in the sidebar → both pages load with the source UI.
- "Calculate" buttons produce charts (Recharts on Risk of Ruin, ECharts on Kelly) identical to the source app.
- No console errors from missing deps.
