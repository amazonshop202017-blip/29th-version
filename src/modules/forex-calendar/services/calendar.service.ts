import type {
  CalendarEventRaw,
  CalendarEvent,
  CalendarConfig,
} from "../types/calendar.types";
import { countryToCurrency, getDateKey } from "../utils/date.utils";
import { normalizeImpact, generateEventId } from "../utils/format.utils";

const DEFAULT_CONFIG: CalendarConfig = {
  apiUrl: "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
  refreshIntervalMs: 0,
  defaultCurrencies: [],
  defaultImpacts: [],
};

const CACHE_KEY = "forex-calendar-cache-v1";
let inFlightRequest: Promise<CalendarEventRaw[]> | null = null;
let inFlightDateKey = "";

function getTodayLocalKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readCache(): CalendarEventRaw[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; data: CalendarEventRaw[] };
    if (!parsed?.date || !Array.isArray(parsed.data)) return null;
    if (parsed.date !== getTodayLocalKey()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: CalendarEventRaw[]): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ date: getTodayLocalKey(), data }),
    );
  } catch {
    // ignore quota/serialization errors
  }
}

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
  const cached = readCache();
  if (cached) {
    return transformEvents(cached);
  }
  const todayKey = getTodayLocalKey();
  if (!inFlightRequest || inFlightDateKey !== todayKey) {
    inFlightDateKey = todayKey;
    inFlightRequest = fetchRawEvents(mergedConfig.apiUrl)
      .then((raw) => {
        writeCache(raw);
        return raw;
      })
      .finally(() => {
        inFlightRequest = null;
      });
  }
  const raw = await inFlightRequest;
  return transformEvents(raw);
}

export { DEFAULT_CONFIG };

// silence unused import warning when types are only used for casts
export type { CalendarEvent };