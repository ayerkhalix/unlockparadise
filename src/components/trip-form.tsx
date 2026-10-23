"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useState } from "react";
import { requestJSON } from "@/lib/client-api";
import { tripDuration, type Trip } from "@/lib/planning";
import { captureInterest } from "@/lib/analytics-client";
export function TripForm({
  trip,
  onSaved,
  onCancel,
}: {
  trip?: Trip;
  onSaved: (trip: Trip) => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [start, setStart] = useState(trip?.start_date || ""),
    [end, setEnd] = useState(trip?.end_date || "");
  const duration = tripDuration(start, end);
  return (
    <ValidatedForm
      className="p2-form"
      data-backend="true"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        const payload = {
          title: f.get("title"),
          notes: f.get("notes"),
          start_date: f.get("start_date") || null,
          end_date: f.get("end_date") || null,
          day_count: duration || trip?.itinerary_days.length || 1,
        };
        try {
          const result = await requestJSON<{ data: Trip }>(
            trip ? `/api/v1/itineraries/${trip.id}/` : "/api/v1/itineraries/",
            trip ? "PATCH" : "POST",
            trip
              ? { action: "update", version: trip.version, payload }
              : payload,
          );
          onSaved(result.data);
          if (!trip) captureInterest("itinerary_created");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Trip name{" "}
        <input
          name="title"
          required
          maxLength={120}
          placeholder="A week in Palawan"
          defaultValue={trip?.title}
        />
      </label>
      <div className="p2-form__row">
        <label>
          Start date{" "}
          <input
            name="start_date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          End date{" "}
          <input
            name="end_date"
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <p role="status">
        {duration
          ? `${duration} ${duration === 1 ? "day" : "days"}`
          : !start && !end
            ? `${trip?.itinerary_days.length || 1} ${(trip?.itinerary_days.length || 1) === 1 ? "day" : "days"} · Dates are flexible`
            : "Choose both dates for a trip of 1 to 60 days."}
      </p>
      <p className="p2-muted">
        Dates set the number of days. Leave both dates open to start a flexible
        plan. You can add days in the planner. Move stops before removing days.
      </p>
      <label>
        Trip notes{" "}
        <textarea
          className="resize-none"
          name="notes"
          rows={3}
          maxLength={5000}
          defaultValue={trip?.notes}
        />
      </label>
      {error && (
        <p className="p2-error" role="alert">
          {error}
        </p>
      )}
      <div className="p2-actions">
        <button className="p2-button" disabled={busy}>
          {busy ? "Saving…" : trip ? "Save trip details" : "Create trip"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="p2-button p2-button--quiet"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </ValidatedForm>
  );
}
