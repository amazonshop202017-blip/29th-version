/**
 * Date/time standardization helpers.
 *
 * Storage rule: every persisted timestamp MUST be a full ISO 8601 UTC string
 * produced by `new Date(...).toISOString()` → `YYYY-MM-DDTHH:mm:ss.sssZ`.
 *
 * Input rule: naive strings (no `Z`, no timezone offset) coming from HTML
 * inputs (`<input type="date">`, `<input type="datetime-local">`) or user-local
 * sources (e.g. MT5 broker exports) are interpreted as the USER'S LOCAL time,
 * then converted to UTC for storage. This matches what the user sees in the UI
 * and what the previous storage format effectively represented.
 *
 * Display rule: ISO UTC strings are converted back to local time at the
 * rendering layer using `new Date(iso)` / `format(...)` / the helpers below.
 */

export type ISODateString = string; // always YYYY-MM-DDTHH:mm:ss.sssZ

const ISO_OFFSET_RE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Normalize any date input into a full ISO 8601 UTC string.
 * - Naive strings (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, `YYYY-MM-DDTHH:mm:ss`)
 *   are interpreted as USER LOCAL time.
 * - Strings with `Z` or an offset are passed through (already absolute).
 * - `Date` / `number` are converted via `.toISOString()`.
 * - `null`/`undefined`/`''`/invalid → `''`.
 */
export function toISO(input: string | number | Date | null | undefined): ISODateString | '' {
  if (input === null || input === undefined || input === '') return '';

  // Date / number → straightforward
  if (input instanceof Date) {
    const t = input.getTime();
    return Number.isFinite(t) ? input.toISOString() : '';
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d.toISOString() : '';
  }

  const s = input.trim();
  if (!s) return '';

  // Already absolute (has Z or +HH:MM / -HH:MM)
  if (ISO_OFFSET_RE.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : '';
  }

  // Date-only → local midnight
  // YYYY-MM-DD
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const local = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    return Number.isFinite(local.getTime()) ? local.toISOString() : '';
  }

  // Naive datetime: YYYY-MM-DDTHH:mm[:ss[.sss]] (or with space)
  const dt = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(s);
  if (dt) {
    const [, y, mo, d, h, mi, se, ms] = dt;
    const local = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      se ? Number(se) : 0,
      ms ? Number(ms.padEnd(3, '0')) : 0,
    );
    return Number.isFinite(local.getTime()) ? local.toISOString() : '';
  }

  // Fallback: let JS try (handles things like RFC strings)
  const fallback = new Date(s);
  return Number.isFinite(fallback.getTime()) ? fallback.toISOString() : '';
}

/** Current instant as full ISO UTC. */
export function nowISO(): ISODateString {
  return new Date().toISOString();
}

/**
 * Convert an ISO UTC string into the value format expected by
 * `<input type="date">` (`YYYY-MM-DD`) using LOCAL calendar.
 */
export function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    // Already in YYYY-MM-DD? return as-is; otherwise empty.
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
    return '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convert an ISO UTC string into the value format expected by
 * `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`) using LOCAL clock.
 */
export function isoToDateTimeLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) return iso.slice(0, 16);
    return '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${mi}`;
}

/** True if the string is already in canonical `...Z` ISO form. */
export function isCanonicalISO(s: unknown): s is ISODateString {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s);
}

/**
 * Local calendar day-key (`YYYY-MM-DD`) derived from a UTC ISO instant.
 * Critical for "today / EOD / per-day bucketing" so a trade closed at
 * 23:30 LOCAL time on Apr 19 buckets into Apr 19 (not Apr 20 in UTC slice).
 */
export function localDayKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
    return '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Local calendar hour-key (`YYYY-MM-DD HH`) derived from a UTC ISO instant.
 * Used for hourly chart bucketing in the user's local clock.
 */
export function localHourKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}`;
}

/** Walks a list of date-like values and warns once per non-canonical entry. */
export function auditISOValues(label: string, values: Array<string | null | undefined>): void {
  if (typeof console === 'undefined') return;
  let bad = 0;
  for (const v of values) {
    if (v && !isCanonicalISO(v)) bad++;
  }
  if (bad > 0) {
    console.warn(`[datetime audit] ${label}: ${bad} non-canonical ISO value(s) detected after migration.`);
  }
}
