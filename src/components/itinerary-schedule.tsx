"use client";
import {
  dayLabel,
  stopTimeLabel,
  tripDateLabel,
  type Trip,
  type TripItem,
} from "@/lib/planning";
import { overlappingStops } from "@/lib/itinerary-schedule";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function DaySchedule({
  stops,
  onStop,
}: {
  stops: TripItem[];
  onStop: (id: string) => void;
}) {
  const conflicts = overlappingStops(stops);
  const scheduled = stops
    .filter((s) => s.start_time && s.end_time)
    .sort(
      (a, b) =>
        a.start_time!.localeCompare(b.start_time!) || a.position - b.position,
    );
  if (!scheduled.length) return null;
  return (
    <section className="p2-day-schedule" aria-label="Daily timeline">
      <div className="p2-schedule-heading">
        <h3>Daily timeline</h3>
        <span>
          {scheduled.length} of {stops.length} stops timed
        </span>
      </div>
      <p className="p2-muted">
        Palawan local time · Allow time to travel between stops.
      </p>
      {conflicts.size > 0 && (
        <p className="p2-schedule-warning" role="status">
          Some visit times overlap. Review the highlighted stops below.
        </p>
      )}
      <ol>
        {scheduled.map((stop) => (
          <li key={stop.id}>
            <button type="button" onClick={() => onStop(stop.id)}>
              <span>
                {stopTimeLabel(stop.start_time, stop.end_time).split(" · ")[0]}
              </span>
              <strong>{stop.place?.title || "Place unavailable"}</strong>
              {conflicts.has(stop.id) && <small>Overlapping time</small>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Text-only, already-authorized trip data stays in this document; no public share or export endpoint. */
export function PrintableItinerary({ trip }: { trip: Trip }) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  if (!mounted) return null;
  return createPortal(
    <article className="p2-print-itinerary" aria-label="Printable itinerary">
      <header>
        <p>Unlock Paradise · Your itinerary</p>
        <h1>{trip.title}</h1>
        <p>{tripDateLabel(trip.start_date, trip.end_date)}</p>
        <p>All visit times are local to Palawan (UTC+8).</p>
        {trip.notes && <p className="p2-print-notes">{trip.notes}</p>}
      </header>
      {trip.itinerary_days.map((day) => {
        const stops = trip.items
          .filter((s) => s.day_id === day.id)
          .sort((a, b) => a.position - b.position);
        const conflicts = overlappingStops(stops);
        return (
          <section key={day.id}>
            <h2>{dayLabel(day, trip.start_date)}</h2>
            {!stops.length ? (
              <p>No stops planned.</p>
            ) : (
              <ol>
                {stops.map((stop) => (
                  <li key={stop.id}>
                    <h3>{stop.place?.title || "Place unavailable"}</h3>
                    <p>
                      {stopTimeLabel(stop.start_time, stop.end_time)}
                      {conflicts.has(stop.id)
                        ? " · Overlapping time — review your schedule"
                        : ""}
                    </p>
                    {stop.place && (
                      <p>
                        {[stop.place.area, stop.place.category]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {stop.notes && (
                      <p className="p2-print-notes">{stop.notes}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
      <footer>
        Visit times do not include travel between destinations. Save as PDF from
        your browser’s print dialog to keep an offline copy.
      </footer>
    </article>,
    document.body,
  );
}
