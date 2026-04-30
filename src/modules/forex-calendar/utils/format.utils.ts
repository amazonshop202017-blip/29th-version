import type { ImpactLevel } from "../types/calendar.types";

export function normalizeImpact(raw: string): ImpactLevel {
  const lower = raw.toLowerCase().trim();
  if (lower === "high") return "High";
  if (lower === "medium") return "Medium";
  if (lower === "low") return "Low";
  if (lower === "holiday") return "Holiday";
  return "Non-Economic";
}

export function safeValue(val: string | null | undefined): string {
  if (!val || val.trim() === "") return "-";
  return val.trim();
}

export function generateEventId(
  title: string,
  country: string,
  dateStr: string
): string {
  return `${country}-${title}-${dateStr}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

const FLAG_MAP: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  NZD: "🇳🇿",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
};

export function getCurrencyFlag(currency: string): string {
  return FLAG_MAP[currency.toUpperCase()] ?? "🏳️";
}