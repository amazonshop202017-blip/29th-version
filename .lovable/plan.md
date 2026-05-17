# Theme Risk of Ruin & Kelly Criterion for Light + Dark Mode

Currently the two ported tool pages use hardcoded dark colors (`#121212`, `#1e1e1e`, `#fff`, `#a0a0a0`, etc.) via custom CSS classes (`.app-container`, `.panel`, `.form-input`, etc.) and inline styles. They look broken in light mode and don't match the rest of the app's dark theme either.

## Goal

Both pages should:
- Look correct in light mode (matching cards, inputs, text colors used elsewhere in the app)
- In dark mode, use the app's dark palette (`hsl(var(--card))`, `hsl(var(--background))`, `hsl(var(--border))`, etc.) instead of the imported `#1e1e1e` / `#121212`
- Keep the exact same layout, behavior, charts, and calculations — only colors/surfaces change

## Approach

Rewrite the ported CSS block in `src/index.css` so all `.app-container`, `.panel`, `.form-input`, `.btn-primary`, `.result-card`, `.info-box`, `.article-text`, table, slider, etc. styles reference semantic HSL tokens (`--background`, `--card`, `--muted`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--profit`, `--loss`, etc.).

Then fix the two component files where colors are inline / hardcoded:

### `src/index.css`
- Remove the hardcoded `:root` block (`--bg-dark`, `--bg-panel`, etc.) that overrode our design tokens.
- Re-map the ported classes to use semantic tokens:
  - `.app-container` → `bg-background text-foreground`, remove forced `min-height`/dark color
  - `.panel`, `.result-card` → `bg-card border-border`
  - `.form-input`, `select.form-input` → `bg-background border-border text-foreground`, focus ring `--ring`
  - `.form-label`, `.form-help`, `.result-title`, `.result-desc` → `text-muted-foreground`
  - `.main-title`, `.panel-title`, `.result-value` → `text-foreground`
  - `.btn-primary` → `bg-primary text-primary-foreground hover:bg-primary-active`
  - `.info-box` → muted/secondary surface with subtle accent
  - `.text-success` / `.text-danger` → `hsl(var(--profit))` / `hsl(var(--loss))`
  - Table borders → `border-border`, header text → `text-muted-foreground`
  - Slider track/thumb → use `--border` track and `--primary` thumb
  - `.article-text` body/headings → `text-foreground` / `text-muted-foreground`

### `src/components/tools/RiskToRuinSimulator.tsx`
Replace inline hardcoded colors with theme tokens:
- `color: '#fff'` / `'#d1d5db'` → use `color: 'hsl(var(--foreground))'` or `'hsl(var(--muted-foreground))'`
- Chart axis tick fills `#a0a0a0`, grid stroke `#333`, tooltip `var(--bg-panel)` → `hsl(var(--muted-foreground))`, `hsl(var(--border))`, `hsl(var(--card))`
- Drawdown area / bars `#ef4444` → `hsl(var(--loss))`
- Risk-level helper `var(--success|warning|danger)` → `hsl(var(--profit))` / amber / `hsl(var(--loss))`
- "Take our quiz" link `#fff` → `hsl(var(--foreground))`

### `src/components/tools/KellySimulator.tsx`
- ECharts options: axis label color `#a0a0a0` → CSS var read at runtime via `getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground')` wrapped in `hsl(...)`; axis line `#333` → `--border`; splitLine `#2d2d2d` → `--border`; legend text `--muted-foreground`; background stays transparent
- Chart series palette: keep distinct colors but swap red `#ef4444` for `hsl(var(--loss))` and green `#22c55e` for `hsl(var(--profit))` so wins/losses match app theme; other Kelly fractions can keep distinct chart colors (`--chart-1..5`)
- Re-call `setOption` (or rebuild options) when theme class changes — add a small `useEffect` MutationObserver on `<html>` class to trigger re-render, mirroring the pattern in `InterfaceThemeContext`
- Replace inline `'#fff'` / `'#9ca3af'` heading & note colors with `hsl(var(--foreground))` / `hsl(var(--muted-foreground))`
- "Take our quiz" link color → `hsl(var(--foreground))`

## Out of scope

- No changes to calculation logic, layout grid, component structure, or libraries (Recharts + ECharts stay).
- No changes to page wrappers `RiskOfRuin.tsx` / `KellyCriterion.tsx` beyond what's needed (likely none — the `.app-container` re-style handles the page bg).

## Verification

- Toggle light/dark mode and confirm both pages: backgrounds, panel surfaces, inputs, buttons, tables, info boxes, charts (axes, tooltips, gridlines), and text all adapt and remain readable with proper contrast.
