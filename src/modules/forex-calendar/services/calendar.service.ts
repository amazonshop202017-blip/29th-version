import type {
  CalendarEventRaw,
  CalendarEvent,
  CalendarConfig,
} from "../types/calendar.types";
import { countryToCurrency, getDateKey } from "../utils/date.utils";
import { normalizeImpact, generateEventId } from "../utils/format.utils";

const DEFAULT_CONFIG: CalendarConfig = {
  apiUrl: "https://forex-calendar.mpin364.workers.dev/",
  refreshIntervalMs: 0,
  defaultCurrencies: [],
  defaultImpacts: [],
};

// Per-tab in-flight dedupe (prevents duplicate fetches on rapid re-renders).
// Shared 24h caching is handled by the Cloudflare Worker.
let inFlightRequest: Promise<CalendarEventRaw[]> | null = null;

async function fetchRawEvents(apiUrl: string): Promise<CalendarEventRaw[]> {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(
      `Calendar API error: ${response.status} ${response.statusText}`
    );
  }
  const data: CalendarEventRaw[] = await response.json();
  return data;
}

function transformEvents(raw: CalendarEventRaw[]): CalendarEvent[] {
  return raw.map((event) => {
    const date = new Date(event.date);
    const currency = countryToCurrency(event.country);
    return {
      id: generateEventId(event.title, event.country, event.date),
      title: event.title,
      country: event.country,
      currency,
      date,
      impact: normalizeImpact(event.impact),
      forecast: event.forecast ?? "",
      previous: event.previous ?? "",
    };
  });
}

export function getUniqueDates(events: CalendarEvent[]): string[] {
  const keys = new Set<string>();
  for (const event of events) {
    keys.add(getDateKey(event.date));
  }
  return Array.from(keys).sort();
}

export async function getCalendarEvents(
  config: Partial<CalendarConfig> = {}
): Promise<CalendarEvent[]> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  if (!inFlightRequest) {
    inFlightRequest = fetchRawEvents(mergedConfig.apiUrl).finally(() => {
      inFlightRequest = null;
    });
  }
  const raw = await inFlightRequest;
  return transformEvents(raw);
}

export { DEFAULT_CONFIG };
export type { CalendarEvent };
