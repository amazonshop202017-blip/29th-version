import type {
  CalendarEventRaw,
  CalendarEvent,
  CalendarConfig,
} from "../types/calendar.types";
import { countryToCurrency, getDateKey } from "../utils/date.utils";
import { normalizeImpact, generateEventId } from "../utils/format.utils";

const DEFAULT_CONFIG: CalendarConfig = {
  apiUrl: "/api/calendar/ff_calendar_thisweek.json",
  refreshIntervalMs: 60_000,
  defaultCurrencies: [],
  defaultImpacts: [],
};

async function fetchRawEvents(
  apiUrl: string
): Promise<CalendarEventRaw[]> {
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
  const raw = await fetchRawEvents(mergedConfig.apiUrl);
  return transformEvents(raw);
}

export { DEFAULT_CONFIG };

// silence unused import warning when types are only used for casts
export type { CalendarEvent };