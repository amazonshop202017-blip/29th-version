## Goal
Wire up the existing "Forex Clock" sidebar link (`/tools/forex-clock`) to a new page that renders the exact `ForexMarketHours` component from the source project "Hello Clock World" — pixel-identical, no edits.

## Steps

1. **Copy the component verbatim**
   - Create `src/pages/tools/ForexClock.tsx` with the full contents of `Hello Clock World/src/pages/ForexMarketHours.tsx` (all 555 lines, unchanged — same inline styles, same purple `#7b2fbe` theme, same `#f0f0f0` page background, same logic).
   - The component is fully self-contained: it uses only React (`useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`) and inline styles. No shadcn, no Tailwind classes, no external deps to install.

2. **Register the route**
   - In `src/App.tsx`, import `ForexClock` and add `<Route path="/tools/forex-clock" element={<ForexClock />} />` alongside the existing Monte Carlo / Streak Analysis routes (inside the `AppLayout` Routes block).

## Notes
- Sidebar link already exists at `src/components/layout/Sidebar.tsx:48`, so no sidebar change needed.
- The component renders its own `min-height: 100vh` light-gray background. It will sit inside `AppLayout` like the other tool pages — matching the user's request that "nothing is changed" from the source.
- Dark mode is intentionally not adapted (the source is light-only and the user asked for a 100% identical copy).
