"use client";
import {
  dayLabel,
  stopTimeLabel,
  tripDateLabel,
  type Trip,
  type TripItem,
} from "@/lib/planning";
import { itineraryBrand } from "@/lib/itinerary-brand";
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
        <div className="p2-print-brand">
          <img src={itineraryBrand} alt="" width={48} height={48} />
          <div>
            <strong>Unlock Paradise</strong>
            <small>Your Palawan itinerary</small>
          </div>
        </div>
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
        Unlock Paradise · unlockparadise.ph · Visit times do not include travel
        between destinations. Save as PDF from your browser’s print dialog to
        keep an offline copy.
      </footer>
    </article>,
    document.body,
  );
}

/** Download only the authorized, rendered text already loaded in this browser. */
export function downloadItinerary(title: string) {
  const printable = document.querySelector(".p2-print-itinerary");
  if (!printable) return;
  const copy = document.implementation.createHTMLDocument(title);
  copy.documentElement.lang = "en";
  const charset = copy.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const viewport = copy.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  const styles = copy.createElement("style");
  styles.textContent = `body{font:16px/1.6 system-ui,sans-serif;color:#183d42;background:#fffdf8;max-width:800px;margin:auto;padding:32px 24px}h1,h2,h3{line-height:1.25}h1{font-size:32px}h2{font-size:24px;margin-top:36px}h3{font-size:18px}li{padding:8px 0}p{margin:6px 0}.p2-print-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.p2-print-brand img{width:48px;height:48px;padding:8px;background:#102a35;border-radius:8px}.p2-print-brand small{display:block;font-size:12px}.p2-print-brand strong{font-size:18px}article{overflow-wrap:anywhere}.p2-print-notes{white-space:pre-wrap}footer{border-top:1px solid #cbd3cb;padding-top:20px;margin-top:36px;font-size:14px}@media print{body{background:white;color:black}section{break-inside:auto}h2,h3{break-after:avoid}li{break-inside:avoid}.p2-print-brand img{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`;
  copy.head.append(charset, viewport, styles);
  copy.body.append(printable.cloneNode(true));
  const url = URL.createObjectURL(
    new Blob(["<!doctype html>\n", copy.documentElement.outerHTML], {
      type: "text/html;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    title
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "unlock-paradise-trip"
  }.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
