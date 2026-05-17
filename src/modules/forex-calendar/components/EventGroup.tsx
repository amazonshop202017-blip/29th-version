import type { EventGroup as EventGroupType } from "../types/calendar.types";
import { EventRow } from "./EventRow";

interface EventGroupProps {
  group: EventGroupType;
}

export function EventGroup({ group }: EventGroupProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[11px] sm:text-xs font-bold text-foreground uppercase tracking-wider whitespace-nowrap">
          {group.dateLabel}
        </h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="hidden md:grid grid-cols-[90px_80px_1fr_90px_90px_90px] px-4 mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Time</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cur</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Event</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center">Impact</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-right">Forecast</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-right">Previous</span>
      </div>

      <div className="flex flex-col gap-2">
        {group.events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
