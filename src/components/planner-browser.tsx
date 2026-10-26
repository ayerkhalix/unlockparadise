"use client";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePlanningCatalog } from "./use-planning-catalog";
import { useSavedPlaces } from "./bucketlist";
import { BucketlistButton } from "./bucketlist-button";
import { ContentImage } from "./ui/content-image";
import { Icon } from "./icon";
import { Modal } from "./ui/modal";
import { ValidatedForm } from "./ui/validated-form";
import { StopTimeFields } from "./stop-time-fields";
import { DestinationSkeleton } from "./ui/destination-skeleton";
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
  const [selectedDayId, setSelectedDayId] = useState(dayId);
  const [addingDayId, setAddingDayId] = useState(dayId);
  const day =
    trip.itinerary_days.find((day) => day.id === selectedDayId) ||
    trip.itinerary_days[0];
  const catalog = usePlanningCatalog(trip.id, trip.area_id);
  const params = useSearchParams();
  const area = trip.areas?.name || "";
  const access = (params.get("access") || "").split("|").filter(Boolean);
  const vip = params.get("vip") === "1";
  const sort = ["date", "rating"].includes(params.get("sort") || "")
    ? params.get("sort")!
    : "name";
  const descending =
    params.get("dir") === "desc" ||
    (params.get("dir") !== "asc" && sort !== "name");
  const [adding, setAdding] = useState<TravelPlace | null>(null),
    [time, setTime] = useState<StopTime>({ start_time: null, end_time: null });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const bucketlist = useSavedPlaces(true);
  const saved = new Set(
    bucketlist.rows.filter((row) => row.saved_at).map((row) => row.place_id),
  );
  const update = (values: Record<string, string>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    query.set("trip", trip.id);
    query.set("day", values.day || day.id);
    for (const obsolete of [
      "area",
      "search",
      "duration",
      "mode",
      "assets",
      "shown",
    ])
      query.delete(obsolete);
    history.replaceState(null, "", `?${query}`);
  };
  const stops = trip.items.filter((item) => item.day_id === day.id);
  const targetStops = trip.items.filter((item) => item.day_id === addingDayId);
  const added = new Set(stops.map((item) => item.place_id));
  const availableCategories = new Set(
    catalog.places.flatMap((place) => place.category.split(" · ")),
  );
  const categories =
    catalog.metadata?.categories
      .map((c) => c.name)
      .filter((name) => availableCategories.has(name)) ||
    [...new Set(catalog.places.flatMap((p) => p.category.split(" · ")))]
      .filter(Boolean)
      .sort();
  const requestedCategory = params.get("category") || "";
  const category = categories.includes(requestedCategory)
    ? requestedCategory
    : categories[0] || "";
  const toggleFacet = (key: "access", value: string) => {
    const current = access;
    update({
      [key]: (current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      ).join("|"),
    });
  };
  const filtered = catalog.places
    .filter(
      (place) =>
        place.category.split(" · ").includes(category) &&
        (!access.length ||
          access.some((mode) => place.accessibility?.includes(mode))) &&
        (!vip || place.vip),
    )
    .sort((first, second) => {
      const [a, b] = descending ? [second, first] : [first, second];
      if (sort === "rating")
        return (
          (a.rating ?? -1) - (b.rating ?? -1) || a.title.localeCompare(b.title)
        );
      if (sort === "date")
        return (
          (a.publishedAt || "").localeCompare(b.publishedAt || "") ||
          a.title.localeCompare(b.title)
        );
      return a.title.localeCompare(b.title);
    });
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
          <label className="planner-browser-day">
            Add destinations to
            <select
              aria-label="Itinerary day"
              value={day.id}
              disabled={busy}
              onChange={(event) => {
                setSelectedDayId(event.target.value);
                update({ day: event.target.value });
              }}
            >
              {trip.itinerary_days.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {dayLabel(choice, trip.start_date)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <a className="p2-button" href={plannerHref(trip.id, day.id)}>
          View itinerary
        </a>
      </div>
      <nav
        className="planner-category-tabs"
        aria-label="Destination categories"
      >
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
      <div
        className="planner-original-filters planner-reference-toolbar"
        aria-label="Destination filters"
      >
        <fieldset className="planner-transport">
          <legend>Accessible by</legend>
          <div className="planner-transport-options">
            {["Motorcycle", "Car", "4x4", "Boat", "Hike"].map((name) => (
              <button
                type="button"
                key={name}
                aria-pressed={access.includes(name)}
                onClick={() => toggleFacet("access", name)}
              >
                <Icon name={name} size={18} /> {name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="planner-reference-sort">
          Sort by
          <select
            value={sort}
            onChange={(event) => update({ sort: event.target.value, dir: "" })}
          >
            <option value="name">Name</option>
            <option value="date">Date added</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
        <button
          className="planner-sort-direction"
          type="button"
          aria-label={descending ? "Sort ascending" : "Sort descending"}
          aria-pressed={descending}
          onClick={() => update({ dir: descending ? "asc" : "desc" })}
        >
          <Icon name="Sort" size={22} />
        </button>
        <div className="planner-reference-secondary">
          <button
            className="planner-premium-chip"
            type="button"
            aria-pressed={vip}
            onClick={() => update({ vip: vip ? "" : "1" })}
          >
            <Icon name="Lock" size={15} /> Explorer+
          </button>
          <button
            className="planner-reset"
            type="button"
            aria-label="Reset destination filters"
            data-tooltip="Reset filters"
            disabled={!access.length && !vip && sort === "name" && !descending}
            onClick={() => update({ access: "", vip: "", sort: "", dir: "" })}
          >
            <Icon name="Reset" size={20} />
          </button>
        </div>
      </div>
      {bucketlist.error && (
        <p className="p2-error" role="status">
          Bucketlist is unavailable.{" "}
          <button type="button" onClick={() => void bucketlist.reload()}>
            Retry Bucketlist
          </button>
        </p>
      )}
      {catalog.loading ? (
        <DestinationSkeleton />
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
              <div className="planner-destination-grid upd-grid">
                {filtered.map((place, index) => (
                  <article
                    className="planner-destination-card upd-card"
                    key={place.id}
                  >
                    <a
                      className="upd-card__link"
                      href={`/place/${place.slug}/?trip=${trip.id}&day=${day.id}`}
                    >
                      <div className="upd-card__photo">
                        {place.image ? (
                          <ContentImage
                            src={place.image || ""}
                            alt={place.title}
                            loading={index < 3 ? "eager" : "lazy"}
                            sizes="(max-width: 600px) 92vw, (max-width: 900px) 46vw, 400px"
                          />
                        ) : (
                          <span className="upd-card__coming-soon">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <div className="upd-card__body">
                        <h2 className="upd-card__title">{place.title}</h2>
                        <dl className="upd-card__stats">
                          <div className="upd-card__stat">
                            <dt className="upd-card__label">Travel time</dt>
                            <dd className="upd-card__value">
                              {place.travelMinutes != null
                                ? `${place.travelMinutes} min`
                                : "Not specified"}
                            </dd>
                          </div>
                          <div className="upd-card__stat upd-card__access">
                            <dt className="upd-card__label">Accessible by</dt>
                            <dd className="upd-card__value upd-card__modes">
                              {place.accessibility?.length
                                ? place.accessibility.map((mode) => (
                                    <span
                                      key={mode}
                                      className="upd-card__mode"
                                      role="img"
                                      aria-label={mode}
                                      data-tooltip={mode}
                                    >
                                      <Icon name={mode} size={16} />
                                    </span>
                                  ))
                                : "Not specified"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </a>
                    <div className="upd-card__save">
                      <BucketlistButton
                        placeId={place.id}
                        saved={saved.has(place.id)}
                        loading={bucketlist.loading || !!bucketlist.error}
                      />
                      <button
                        type="button"
                        className="p2-card-plan"
                        aria-label={
                          added.has(place.id)
                            ? "Added to itinerary"
                            : "Add to itinerary"
                        }
                        disabled={busy || added.has(place.id)}
                        onClick={() => {
                          setTime({ start_time: null, end_time: null });
                          setError("");
                          setAddingDayId(day.id);
                          setAdding(place);
                        }}
                      >
                        {added.has(place.id)
                          ? "Added to itinerary"
                          : "+ Itinerary"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="p2-empty">
              <h2>No destinations match</h2>
              <p>
                Try another category or clear your filters within{" "}
                {area || "this trip’s area"}.
              </p>
              <button
                type="button"
                className="p2-button p2-button--quiet"
                onClick={() =>
                  update({
                    access: "",
                    category: "",
                    assets: "",
                    vip: "",
                  })
                }
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
      <div className="planner-browser-return">
        <a
          className="p2-button p2-button--quiet"
          href={`${plannerHref(trip.id, day.id)}&view=map`}
        >
          My route <Icon name="Explore" size={18} />
        </a>
        <a
          className="p2-back"
          href={`${plannerHref(trip.id, day.id)}&view=schedule`}
        >
          View schedule
        </a>
      </div>
      {adding && (
        <Modal
          title={`Add ${adding.title}`}
          onClose={() => {
            if (!busy) setAdding(null);
          }}
        >
          <p>
            {trip.title} · {area}
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
                    payload: {
                      day_id: addingDayId,
                      place_id: adding.id,
                      ...time,
                    },
                  },
                );
                setTrip(result.data);
                setSelectedDayId(addingDayId);
                update({ day: addingDayId });
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
              <label>
                Add to day
                <select
                  aria-label="Add to day"
                  value={addingDayId}
                  onChange={(event) => setAddingDayId(event.target.value)}
                >
                  {trip.itinerary_days.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {dayLabel(choice, trip.start_date)}
                    </option>
                  ))}
                </select>
              </label>
              <StopTimeFields value={time} onChange={setTime} />
            </fieldset>
            {overlappingStops([...targetStops, { id: "new", ...time }]).has(
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
