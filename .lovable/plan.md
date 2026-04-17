
Dark-mode-only color tweaks for the dashboard's Monthly Performance Calendar. Currently:
- Empty (no-trade) current-month days use `bg-secondary/30` (works for both themes).
- Week summary cards use `bg-secondary/30`.
- Non-current-month days use a hardcoded `backgroundColor: '#fcfcfe'` with stripes at `hsl(var(--muted-foreground) / 0.063)` — this hardcoded white shows in dark mode too, which we need to override.

## Plan

Edit `src/components/dashboard/MonthlyPerformanceCalendar.tsx`:

1. **Empty current-month day cards** (no trades that day):
   - Keep light mode as `bg-secondary/30`.
   - Add dark-mode override using `dark:bg-[#1f1f1f]` so `bgClass` becomes `bg-secondary/30 dark:bg-[#1f1f1f]`.

2. **Weekly summary cards** (right column: Week 1, Week 2…):
   - Change className from `bg-secondary/30` to `bg-secondary/30 dark:bg-[#1f1f1f]`.

3. **Non-current-month day cards** (previous/next month with diagonal stripes):
   - Replace the hardcoded inline `backgroundColor: '#fcfcfe'` with theme-aware styling. Use a CSS approach: drop the inline `backgroundColor` and instead apply Tailwind classes `bg-[#fcfcfe] dark:bg-[#171717]` so light mode keeps `#fcfcfe` and dark mode uses `#171717`.
   - Keep the diagonal stripe pattern via inline `backgroundImage`, but make stripe color lighter in dark mode. Since inline styles can't react to theme, switch the stripe to use a CSS variable already wired for theming. Approach: use `hsl(var(--foreground) / 0.08)` in light mode and a brighter alpha in dark mode. Implementation: detect dark mode via the existing `useTheme` hook (or read `document.documentElement.classList.contains('dark')` once via `useTheme`) and pick the stripe alpha conditionally — light: `hsl(0 0% 0% / 0.063)`, dark: `hsl(0 0% 100% / 0.18)`.

4. **Scope guarantee**: All three changes are additive `dark:` variants or theme-conditional values. Light mode visuals remain identical.

## Files Touched
- `src/components/dashboard/MonthlyPerformanceCalendar.tsx` (only)

