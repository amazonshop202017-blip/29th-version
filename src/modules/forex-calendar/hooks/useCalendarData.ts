import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  CalendarEvent,
  CalendarConfig,
} from "../types/calendar.types";
import {
  getCalendarEvents,
  getUniqueDates,
  DEFAULT_CONFIG,
} from "../services/calendar.service";

interface UseCalendarDataReturn {
  events: CalendarEvent[];
  availableDates: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCalendarData(
  config: Partial<CalendarConfig> = {}
): UseCalendarDataReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await getCalendarEvents(config);
      setEvents(data);
      setAvailableDates(getUniqueDates(data));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch calendar data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedConfig.apiUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    events,
    availableDates,
    isLoading,
    error,
    refetch: fetchData,
  };
}