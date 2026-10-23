"use client";
import { captureInterest } from "@/lib/analytics-client";
import { ValidatedForm } from "./ui/validated-form";
import { useEffect, useState } from "react";
import { Modal } from "./ui/modal";
import { TripForm } from "./trip-form";
import { dayLabel, plannerHref, type Trip } from "@/lib/planning";
import { notify, requestJSON } from "@/lib/client-api";
import { StopTimeFields } from "./stop-time-fields";
import type { StopTime } from "@/lib/planning";
export function ItineraryPicker({
  placeId,
  onClose,
}: {
  placeId: string;
  onClose: () => void;
}) {
  const [trips, setTrips] = useState<Trip[]>([]),
    [tripId, setTripId] = useState(""),
    [dayId, setDayId] = useState(""),
    [create, setCreate] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [added, setAdded] = useState(false);
  const [visitTime, setVisitTime] = useState<StopTime>({
    start_time: null,
    end_time: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    requestJSON<{ data: Trip[] }>(
      "/api/v1/itineraries/",
      "GET",
      undefined,
      controller.signal,
    )
      .then((r) => {
        setTrips(r.data);
        const query = new URLSearchParams(location.search);
        const preferred =
          r.data.find((t) => t.id === query.get("trip")) || r.data[0];
        setTripId(preferred?.id || "");
        setDayId(
          preferred?.itinerary_days.find((d) => d.id === query.get("day"))
            ?.id ||
            preferred?.itinerary_days
              .slice()
              .sort((a, b) => a.day_number - b.day_number)[0]?.id ||
            "",
        );
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const trip = trips.find((t) => t.id === tripId);
  return (
    <Modal title="Add to Itinerary" onClose={onClose}>
      {added ? (
        <div className="p2-empty">
          <h3>Your next stop is planned.</h3>
          <p>Saved to {trip?.title}.</p>
          <a className="p2-button" href={plannerHref(tripId, dayId)}>
            Open planner
          </a>
          <button className="p2-button p2-button--quiet" onClick={onClose}>
            Keep exploring
          </button>
        </div>
      ) : (
        <>
          <p className="p2-muted">Choose a trip and day for this Place.</p>
          {loading ? (
            <p role="status">Loading your trips…</p>
          ) : create || (!trips.length && !error) ? (
            <TripForm
              onSaved={(t) => {
                setTrips([t, ...trips]);
                setTripId(t.id);
                setDayId(t.itinerary_days[0].id);
                setCreate(false);
              }}
              onCancel={trips.length ? () => setCreate(false) : onClose}
            />
          ) : (
            <ValidatedForm
              className="p2-form"
              data-backend="true"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!trip) return;
                setBusy(true);
                setError("");
                try {
                  const result = await requestJSON<{ data: Trip }>(
                    `/api/v1/itineraries/${trip.id}/`,
                    "PATCH",
                    {
                      version: trip.version,
                      action: "add",
                      payload: {
                        place_id: placeId,
                        day_id: dayId,
                        ...visitTime,
                      },
                    },
                  );
                  window.dispatchEvent(
                    new CustomEvent("upd:itinerary-saved", {
                      detail: result.data,
                    }),
                  );
                  setAdded(true);
                  captureInterest("place_added_to_itinerary", {
                    place_id: placeId,
                  });
                  notify("Place added to your itinerary.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {trips.length > 0 && (
                <>
                  <label>
                    Trip
                    <select
                      aria-label="Trip"
                      value={tripId}
                      onChange={(e) => {
                        setTripId(e.target.value);
                        setDayId(
                          trips
                            .find((t) => t.id === e.target.value)
                            ?.itinerary_days.slice()
                            .sort((a, b) => a.day_number - b.day_number)[0]
                            ?.id || "",
                        );
                      }}
                    >
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Day
                    <select
                      aria-label="Day"
                      value={dayId}
                      onChange={(e) => setDayId(e.target.value)}
                    >
                      {trip?.itinerary_days
                        .slice()
                        .sort((a, b) => a.day_number - b.day_number)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {dayLabel(d, trip.start_date)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <fieldset className="p2-fieldset" disabled={busy}>
                    <StopTimeFields value={visitTime} onChange={setVisitTime} />
                  </fieldset>
                  <button className="p2-button" disabled={busy || !dayId}>
                    {busy ? "Adding…" : "Add Place"}
                  </button>
                </>
              )}
              <button
                type="button"
                className="p2-button p2-button--quiet"
                disabled={busy}
                onClick={() => setCreate(true)}
              >
                Create a new trip
              </button>
            </ValidatedForm>
          )}
          {error && (
            <div className="p2-error" role="alert">
              <p>{error}</p>
              <button
                className="p2-button p2-button--quiet"
                disabled={busy}
                onClick={() => {
                  setAttempt(attempt + 1);
                  setLoading(true);
                }}
              >
                Reload trips
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
