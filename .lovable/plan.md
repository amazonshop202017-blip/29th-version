# Switch calendar/news to Cloudflare Worker

The Worker at `https://forex-calendar.mpin364.workers.dev/` handles CORS, upstream fetch, and 24h edge caching for all users. Both the KPI widget and News page already go through `getCalendarEvents()` in `src/modules/forex-calendar/services/calendar.service.ts`, so a single file is the only change needed.

## Changes

### `src/modules/forex-calendar/services/calendar.service.ts`
- Replace `DEFAULT_CONFIG.apiUrl` with `https://forex-calendar.mpin364.workers.dev/`.
- Remove the localStorage cache (`CACHE_KEY`, `readCache`, `writeCache`, today-key helper) — the Worker now provides the shared 24h cache.
- Keep the per-tab in-flight request dedupe (cheap, prevents duplicate fetches on rapid re-renders within one session).
- Keep parsing/transform (`fetchRawEvents`, `transformEvents`, `getUniqueDates`) and exported types unchanged.

### `vite.config.ts`
- Already has no `server.proxy` — no change needed. Confirmed.

## Out of scope
- No changes to KPI widget, News page UI, types, or `useCalendarData` hook.
