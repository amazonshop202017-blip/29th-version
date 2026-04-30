/** Country code to currency code mapping */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  CAD: "CAD",
  AUD: "AUD",
  NZD: "NZD",
  CHF: "CHF",
  CNY: "CNY",
};

export function countryToCurrency(country: string): string {
  const upper = country.toUpperCase().trim();
  return COUNTRY_TO_CURRENCY[upper] ?? upper;
}

export function formatDateHeader(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTabLabel(date: Date): string {
  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  const dateNum = date.getDate();
  const month = date.getMonth() + 1;
  return `${day} ${dateNum}.${month}`;
}

export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatTimezone(tz: string): string {
  const now = new Date();
  const offsetMin = now.getTimezoneOffset();
  const sign = offsetMin <= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;
  const offsetStr = mins > 0 ? `UTC${sign}${hours}:${String(mins).padStart(2, "0")}` : `UTC${sign}${hours}`;
  const cityName = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  return `${offsetStr} (${cityName})`;
}