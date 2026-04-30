/** Raw event shape from the API */
export interface CalendarEventRaw {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

/** Normalized impact levels */
export type ImpactLevel = "High" | "Medium" | "Low" | "Holiday" | "Non-Economic";

/** Processed calendar event for UI consumption */
export interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  date: Date;
  impact: ImpactLevel;
  forecast: string;
  previous: string;
}

/** Events grouped by date string */
export interface EventGroup {
  dateLabel: string;
  date: Date;
  events: CalendarEvent[];
}

/** Supported currency codes */
export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CAD"
  | "AUD"
  | "NZD"
  | "CHF";

/** Filter state for the calendar */
export interface CalendarFilters {
  currencies: CurrencyCode[];
  impacts: ImpactLevel[];
  selectedDate: string | null;
}

/** Calendar config for the module */
export interface CalendarConfig {
  apiUrl: string;
  refreshIntervalMs: number;
  defaultCurrencies: CurrencyCode[];
  defaultImpacts: ImpactLevel[];
}