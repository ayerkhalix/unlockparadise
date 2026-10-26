"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useEffect, useState } from "react";
import { requestJSON } from "@/lib/client-api";
import { tripDuration, type Trip } from "@/lib/planning";
import { captureInterest } from "@/lib/analytics-client";
export function TripForm({
  trip,
  onSaved,
  onCancel,
  onDelete,
  initialAreaId = "",
  createLabel = "Create trip",
}: {
  trip?: Trip;
  onSaved: (trip: Trip) => void;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
  initialAreaId?: string;
  createLabel?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [start, setStart] = useState(trip?.start_date || ""),
    [end, setEnd] = useState(trip?.end_date || "");
  const [area, setArea] = useState(trip?.area_id || initialAreaId);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true),
    [areaError, setAreaError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    requestJSON<{ data: { id: string; name: string }[] }>(
      "/api/v1/areas/",
      "GET",
      undefined,
      controller.signal,
    )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setAreas(data);
          setLoadingAreas(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAreaError(error.message);
          setLoadingAreas(false);
        }
      });
    return () => controller.abort();
  }, [revision]);
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
          area_id: area,
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
      <label>
        Trip area
        <select
          name="area_id"
          aria-label="Trip area"
          required
          value={area}
          disabled={busy || loadingAreas || !!areaError}
          onChange={(event) => setArea(event.target.value)}
        >
          <option value="">
            {loadingAreas ? "Loading areas…" : "Choose one area"}
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>
      <p className="p2-muted">
        Your destination choices will stay within this area.
      </p>
      {areaError && (
        <div className="p2-error" role="alert">
          <p>{areaError}</p>
          <button
            type="button"
            className="p2-back"
            onClick={() => {
              setAreaError("");
              setLoadingAreas(true);
              setRevision((value) => value + 1);
            }}
          >
            Reload areas
          </button>
        </div>
      )}
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
        <button
          className="p2-button"
          disabled={busy || loadingAreas || !!areaError}
        >
          {busy ? "Saving…" : trip ? "Save trip details" : createLabel}
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
      {onDelete && (
        <div className="planner-edit-danger">
          <button
            type="button"
            className="p2-button p2-button--quiet"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete();
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete trip
          </button>
        </div>
      )}
    </ValidatedForm>
  );
}
