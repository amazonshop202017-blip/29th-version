import { useState, useMemo, useCallback } from "react";
import type {
  CalendarEvent,
  CalendarFilters,
  CurrencyCode,
  ImpactLevel,
  EventGroup,
} from "../types/calendar.types";
import { getDateKey, formatDateHeader } from "../utils/date.utils";

interface UseFiltersReturn {
  filters: CalendarFilters;
  filteredGroups: EventGroup[];
  toggleCurrency: (currency: CurrencyCode) => void;
  toggleImpact: (impact: ImpactLevel) => void;
  setSelectedDate: (date: string | null) => void;
  resetFilters: () => void;
}

export function useFilters(events: CalendarEvent[]): UseFiltersReturn {
  const [filters, setFilters] = useState<CalendarFilters>({
    currencies: [],
    impacts: [],
    selectedDate: null,
  });

  const toggleCurrency = useCallback((currency: CurrencyCode) => {
    setFilters((prev) => ({
      ...prev,
      currencies: prev.currencies.includes(currency)
        ? prev.currencies.filter((c) => c !== currency)
        : [...prev.currencies, currency],
    }));
  }, []);

  const toggleImpact = useCallback((impact: ImpactLevel) => {
    setFilters((prev) => ({
      ...prev,
      impacts: prev.impacts.includes(impact)
        ? prev.impacts.filter((i) => i !== impact)
        : [...prev.impacts, impact],
    }));
  }, []);

  const setSelectedDate = useCallback((date: string | null) => {
    setFilters((prev) => ({
      ...prev,
      selectedDate: date,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      currencies: [],
      impacts: [],
      selectedDate: null,
    });
  }, []);

  const filteredGroups = useMemo(() => {
    let filtered = [...events];

    if (filters.currencies.length > 0) {
      filtered = filtered.filter((e) =>
        filters.currencies.includes(e.currency as CurrencyCode)
      );
    }

    if (filters.impacts.length > 0) {
      filtered = filtered.filter((e) => filters.impacts.includes(e.impact));
    }

    if (filters.selectedDate) {
      filtered = filtered.filter(
        (e) => getDateKey(e.date) === filters.selectedDate
      );
    }

    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of filtered) {
      const key = getDateKey(event.date);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    }

    const groups: EventGroup[] = [];
    const sortedKeys = Array.from(grouped.keys()).sort();
    for (const key of sortedKeys) {
      const groupEvents = grouped.get(key)!;
      groupEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
      groups.push({
        dateLabel: formatDateHeader(groupEvents[0].date),
        date: groupEvents[0].date,
        events: groupEvents,
      });
    }

    return groups;
  }, [events, filters]);

  return {
    filters,
    filteredGroups,
    toggleCurrency,
    toggleImpact,
    setSelectedDate,
    resetFilters,
  };
}