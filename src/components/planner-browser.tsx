"use client";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePlanningCatalog } from "./use-planning-catalog";
import { SearchInput } from "./ui/search-input";
import { ContentImage } from "./ui/content-image";
import { Modal } from "./ui/modal";
import { ValidatedForm } from "./ui/validated-form";
import { StopTimeFields } from "./stop-time-fields";
import {
  dayLabel,
  plannerHref,
  type Trip,
  type TravelPlace,
  type StopTime,
} from "@/lib/planning";
import { notify, requestJSON } from "@/lib/client-api";
import { captureInterest } from "@/lib/analytics-client";
import { overlappingStops } from "@/lib/itinerary-schedule";

export function PlannerBrowser({
  initial,
  dayId,
}: {
  initial: Trip;
  dayId: string;
}) {
  const [trip, setTrip] = useState(initial);
  const day = trip.itinerary_days.find((day) => day.id === dayId)!;
  const catalog = usePlanningCatalog();
  const params = useSearchParams();
  const search = params.get("search") || "",
    area = params.get("area") || "",
    category = params.get("category") || "",
    mode = params.get("mode") || "",
    duration = params.get("duration") || "",
    sort = params.get("sort") || "name";
  const [limit, setLimit] = useState(24),
    [adding, setAdding] = useState<TravelPlace | null>(null),
    [time, setTime] = useState<StopTime>({ start_time: null, end_time: null });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const update = (values: Record<string, string>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    query.set("trip", trip.id);
    query.set("day", day.id);
    history.replaceState(null, "", `?${query}`);
    setLimit(24);
  };
  const stops = trip.items.filter((item) => item.day_id === dayId);
  const added = new Set(stops.map((item) => item.place_id));
  const areas = [...new Set(catalog.places.flatMap((p) => p.area.split(" · ")))]
    .filter(Boolean)
    .sort();
  const categories =
    catalog.metadata?.categories.map((c) => c.name) ||
    [...new Set(catalog.places.flatMap((p) => p.category.split(" · ")))]
      .filter(Boolean)
      .sort();
  const filtered = useMemo(
    () =>
      catalog.places
        .filter(
          (p) =>
            (!area || p.area.split(" · ").includes(area)) &&
            (!category || p.category.split(" · ").includes(category)) &&
            p.title
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase().trim()) &&
            (!mode || p.accessibility?.includes(mode)) &&
            (!duration ||
              (p.travelMinutes != null && p.travelMinutes <= Number(duration))),
        )
        .sort((a, b) =>
          sort === "time"
            ? (a.travelMinutes ?? Infinity) - (b.travelMinutes ?? Infinity) ||
              a.title.localeCompare(b.title)
            : a.title.localeCompare(b.title),
        ),
    [catalog.places, area, category, search, mode, duration, sort],
  );
  const cover = filtered.find((place) => place.image)?.image;
  const reloadTrip = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const response = await requestJSON<{ data: Trip }>(
        `/api/v1/itineraries/${trip.id}/`,
        "GET",
      );
      setTrip(response.data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      pending.current = false;
    }
  };
  return (
    <div className="planner-browser">
      <div className="planner-browser-bar">
        <div>
          <a className="p2-back" href={plannerHref(trip.id, day.id)}>
            Back to {trip.title}
          </a>
          <p>
            {dayLabel(day, trip.start_date)} · {stops.length}{" "}
            {stops.length === 1 ? "stop" : "stops"}
          </p>
        </div>
        <a className="p2-button" href={plannerHref(trip.id, day.id)}>
          View final itinerary
        </a>
      </div>
      <nav
        className="planner-category-tabs"
        aria-label="Destination categories"
      >
        <button
          type="button"
          aria-pressed={!category}
          onClick={() => update({ category: "" })}
        >
          All destinations
        </button>
        {categories.map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={category === name}
            onClick={() => update({ category: name })}
          >
            {name}
          </button>
        ))}
      </nav>
      <header className={`planner-browser-hero${cover ? " has-photo" : ""}`}>
        {cover && <ContentImage src={cover} alt="" />}
        <div>
          <h1>{category || "Find your next stop"}</h1>
          <p>{area || "Explore Palawan"}</p>
        </div>
      </header>
      <div className="planner-browser-filters">
        <label>
          Search destinations
          <SearchInput
            label="Search destinations"
            value={search}
            onValueChange={(search) => update({ search })}
            placeholder="Search by destination name"
          />
        </label>
        <label>
          Area
          <select
            value={area}
            onChange={(e) => update({ area: e.target.value })}
          >
            <option value="">All areas</option>
            {areas.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Accessible by
          <select
            value={mode}
            onChange={(e) => update({ mode: e.target.value })}
          >
            <option value="">Any transport</option>
            {["Motorcycle", "Car", "4x4", "Boat", "Hike"].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Travel time
          <select
            value={duration}
            onChange={(e) => update({ duration: e.target.value })}
          >
            <option value="">Any duration</option>
            {[15, 30, 60, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                Up to {minutes} min
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="name">Name</option>
            <option value="time">Travel time</option>
          </select>
        </label>
      </div>
      {catalog.loading ? (
        <p role="status">Loading destinations…</p>
      ) : catalog.error ? (
        <div className="p2-error" role="alert">
          <p>{catalog.error}</p>
          <button type="button" className="p2-button" onClick={catalog.reload}>
            Retry destinations
          </button>
        </div>
      ) : (
        <>
          <p className="planner-browser-count" role="status">
            {filtered.length}{" "}
            {filtered.length === 1 ? "destination" : "destinations"} · Adding to{" "}
            {dayLabel(day, trip.start_date)}
          </p>
          {filtered.length ? (
            <>
              <div className="planner-destination-grid">
                {filtered.slice(0, limit).map((place) => (
                  <article className="planner-destination-card" key={place.id}>
                    <a
                      href={`/place/${place.slug}/?trip=${trip.id}&day=${day.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${place.title}`}
                    >
                      <ContentImage
                        src={place.image || ""}
                        alt={place.title}
                        loading="lazy"
                      />
                      <div>
                        <p>{place.area}</p>
                        <h2>{place.title}</h2>
                      </div>
                    </a>
                    <p>
                      {place.category}
                      {place.travelMinutes != null
                        ? ` · ${place.travelMinutes} min travel`
                        : ""}
                    </p>
                    <button
                      type="button"
                      className="p2-button"
                      disabled={busy || added.has(place.id)}
                      onClick={() => {
                        setTime({ start_time: null, end_time: null });
                        setError("");
                        setAdding(place);
                      }}
                    >
                      {added.has(place.id)
                        ? "Added to itinerary"
                        : "Add to itinerary"}
                    </button>
                  </article>
                ))}
              </div>
              {filtered.length > limit && (
                <button
                  type="button"
                  className="p2-button p2-button--quiet"
                  onClick={() => setLimit((n) => n + 24)}
                >
                  Show more destinations
                </button>
              )}
            </>
          ) : (
            <div className="p2-empty">
              <h2>No destinations match</h2>
              <p>Try another area or category, or clear your filters.</p>
              <button
                type="button"
                className="p2-button p2-button--quiet"
                onClick={() =>
                  update({
                    search: "",
                    category: "",
                    area: "",
                    mode: "",
                    duration: "",
                  })
                }
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
      {adding && (
        <Modal
          title={`Add ${adding.title}`}
          onClose={() => {
            if (!busy) setAdding(null);
          }}
        >
          <p>
            {dayLabel(day, trip.start_date)} · {trip.title}
          </p>
          <ValidatedForm
            className="p2-form"
            data-backend="true"
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError("");
              try {
                const result = await requestJSON<{ data: Trip }>(
                  `/api/v1/itineraries/${trip.id}/`,
                  "PATCH",
                  {
                    version: trip.version,
                    action: "add",
                    payload: { day_id: day.id, place_id: adding.id, ...time },
                  },
                );
                setTrip(result.data);
                window.dispatchEvent(
                  new CustomEvent("upd:itinerary-saved", {
                    detail: result.data,
                  }),
                );
                captureInterest("place_added_to_itinerary", {
                  place_id: adding.id,
                });
                setAdding(null);
                notify("Destination added to your itinerary.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            <fieldset className="p2-fieldset" disabled={busy}>
              <StopTimeFields value={time} onChange={setTime} />
            </fieldset>
            {overlappingStops([...stops, { id: "new", ...time }]).has(
              "new",
            ) && (
              <p className="p2-schedule-warning">
                This visit overlaps another stop. You can choose another time or
                add it as planned.
              </p>
            )}
            {error && (
              <div className="p2-error" role="alert">
                <p>{error}</p>
                <button
                  className="p2-back"
                  type="button"
                  disabled={busy}
                  onClick={reloadTrip}
                >
                  Reload saved itinerary
                </button>
              </div>
            )}
            <div className="p2-actions">
              <button className="p2-button" disabled={busy}>
                {busy ? "Adding…" : "Add destination"}
              </button>
              <button
                type="button"
                className="p2-button p2-button--quiet"
                disabled={busy}
                onClick={() => setAdding(null)}
              >
                Cancel
              </button>
            </div>
          </ValidatedForm>
        </Modal>
      )}
    </div>
  );
}
