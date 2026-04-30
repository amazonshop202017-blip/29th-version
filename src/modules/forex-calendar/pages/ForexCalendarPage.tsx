import { CalendarHeader } from "../components/CalendarHeader";
import { Filters } from "../components/Filters";
import { DateTabs } from "../components/DateTabs";
import { TimezoneBar } from "../components/TimezoneBar";
import { EventGroup } from "../components/EventGroup";
import { useCalendarData } from "../hooks/useCalendarData";
import { useFilters } from "../hooks/useFilters";
import type { CalendarConfig } from "../types/calendar.types";

interface ForexCalendarPageProps {
  config?: Partial<CalendarConfig>;
}

export function ForexCalendarPage({ config }: ForexCalendarPageProps) {
  const { events, availableDates, isLoading, error } = useCalendarData(config);
  const {
    filters,
    filteredGroups,
    toggleCurrency,
    toggleImpact,
    setSelectedDate,
  } = useFilters(events);

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <CalendarHeader />

        <Filters
          selectedCurrencies={filters.currencies}
          selectedImpacts={filters.impacts}
          onToggleCurrency={toggleCurrency}
          onToggleImpact={toggleImpact}
        />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-8 mt-4">
          <DateTabs
            dates={availableDates}
            selectedDate={filters.selectedDate}
            onSelectDate={setSelectedDate}
          />
          <TimezoneBar />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">
                Loading economic events...
              </p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              Please check your connection and try again.
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-gray-400 font-medium">
                  No events match your current filters.
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <EventGroup key={group.dateLabel} group={group} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}