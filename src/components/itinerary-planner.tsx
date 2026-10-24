"use client";
import { captureInterest } from "@/lib/analytics-client";
import { ValidatedForm } from "./ui/validated-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  dayLabel,
  tripDateLabel,
  stopTimeLabel,
  type StopTime,
  type Trip,
  type TripItem,
  type TravelPlace,
} from "@/lib/planning";
import { notify, requestJSON } from "@/lib/client-api";
import { TripForm } from "./trip-form";
import { useDecision } from "./ui/decision";
import { Modal } from "./ui/modal";
import { PlaceSearch, type PlaceSearchFilters } from "./place-search";
import { PalawanMap } from "./palawan-map";
import { usePlanningCatalog } from "./use-planning-catalog";
import { StopTimeFields } from "./stop-time-fields";
import {
  DaySchedule,
  PrintableItinerary,
  downloadItinerary,
} from "./itinerary-schedule";
import { PlannerStopActions } from "./planner-stop-actions";
import { Icon } from "./icon";
import { ContentImage } from "./ui/content-image";
import { overlappingStops } from "@/lib/itinerary-schedule";
function StopTiming({
  item,
  onSave,
  onDirtyChange,
  conflicts = [],
}: {
  item: TripItem;
  onSave: (time: StopTime) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  conflicts?: TripItem[];
}) {
  const initial = {
    start_time: item.start_time?.slice(0, 5) || null,
    end_time: item.end_time?.slice(0, 5) || null,
  };
  const [time, setTime] = useState<StopTime>(initial),
    [saved, setSaved] = useState(initial);
  const dirty =
    time.start_time !== saved.start_time || time.end_time !== saved.end_time;
  const [range, duration] = item.start_time
    ? stopTimeLabel(item.start_time, item.end_time).split(" · ")
    : ["Set visit time"];
  return (
    <details className="p2-stop-notes p3-stop-timing">
      <summary>
        <span>{range}</span>
        {duration && <small> · {duration}</small>}
      </summary>
      <ValidatedForm
        className="p2-form"
        data-backend="true"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave(time)) {
            setSaved(time);
            onDirtyChange(false);
          }
        }}
      >
        <StopTimeFields
          value={time}
          onChange={(value) => {
            setTime(value);
            onDirtyChange(
              value.start_time !== saved.start_time ||
                value.end_time !== saved.end_time,
            );
          }}
        />
        {overlappingStops([{ ...item, ...time }, ...conflicts]).has(
          item.id,
        ) && (
          <p className="p2-schedule-warning" role="status">
            This time overlaps another stop on this day. You can still save it
            or choose another time.
          </p>
        )}
        <button className="p2-button p2-button--quiet" disabled={!dirty}>
          Save time
        </button>
      </ValidatedForm>
    </details>
  );
}
function StopNotes({
  item,
  onSave,
  onDirtyChange,
}: {
  item: TripItem;
  onSave: (notes: string) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [notes, setNotes] = useState(item.notes),
    [saved, setSaved] = useState(item.notes);
  return (
    <details className="p2-stop-notes p3-stop-note-editor">
      <summary>
        <Icon name="Notes" size={20} />
        <span>Notes{saved ? " · Added" : ""}</span>
      </summary>
      <ValidatedForm
        data-backend="true"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave(notes)) {
            setSaved(notes);
            onDirtyChange(false);
          }
        }}
      >
        <label htmlFor={`stop-notes-${item.id}`}>Notes for this stop</label>
        <textarea
          id={`stop-notes-${item.id}`}
          className="resize-none"
          maxLength={2000}
          rows={3}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            onDirtyChange(e.target.value !== saved);
          }}
        />
        <button
          className="p2-button p2-button--quiet"
          disabled={notes === saved}
        >
          Save note
        </button>
      </ValidatedForm>
    </details>
  );
}
export function ItineraryPlanner({
  initial,
  onUpdated,
  onDeleted,
  onDirtyChange,
  onBusyChange,
}: {
  initial: Trip;
  onUpdated: (trip: Trip) => void;
  onDeleted: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const dirtyNotes = useRef(new Set<string>());
  const [exportMounted, setExportMounted] = useState(false);
  const [trip, setTrip] = useState(initial);
  const mapPanel = useRef<HTMLElement>(null);
  const catalog = usePlanningCatalog(initial.id, trip.area_id);
  const [filters, setFilters] = useState<PlaceSearchFilters>({
    search: "",
  });
  const router = useRouter();
  const [adding, setAdding] = useState<TravelPlace | null>(null);
  const [visitTime, setVisitTime] = useState<StopTime>({
    start_time: null,
    end_time: null,
  });
  const chooseStop = (place: TravelPlace) => {
    setVisitTime({ start_time: null, end_time: null });
    setAdding(place);
  };
  const filteredPlaces = useMemo(
    () =>
      catalog.places.filter((p) =>
        p.title
          .toLocaleLowerCase()
          .includes(filters.search.trim().toLocaleLowerCase()),
      ),
    [catalog.places, filters],
  );
  const requestedDay = useSearchParams().get("day");
  const { ask, dialog } = useDecision();
  const [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [view, setView] = useState("plan"),
    [drag, setDrag] = useState<{ id: string; over: string } | null>(null);
  const day =
    trip.itinerary_days.find((d) => d.id === requestedDay) ||
    trip.itinerary_days[0];
  const stops = useMemo(
    () =>
      trip.items
        .filter((i) => i.day_id === day.id)
        .sort((a, b) => a.position - b.position),
    [trip.items, day.id],
  );
  const locations = useMemo(
    () => stops.map((s) => s.place).filter((p): p is TravelPlace => !!p),
    [stops],
  );
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    const updated = (event: Event) => {
      const next = (event as CustomEvent<Trip>).detail;
      if (next?.id === initial.id) {
        setTrip(next);
        onUpdated(next);
      }
    };
    window.addEventListener("upd:itinerary-saved", updated);
    return () => window.removeEventListener("upd:itinerary-saved", updated);
  }, [initial.id, onUpdated]);
  const changeDay = async (id: string) => {
    if (id === day.id) return;
    if (
      dirtyNotes.current.size &&
      !(await ask("Discard unsaved stop notes or times before switching days?"))
    )
      return;
    dirtyNotes.current.clear();
    onDirtyChange(false);
    const url = new URL(location.href);
    url.searchParams.set("trip", trip.id);
    url.searchParams.set("day", id);
    history.replaceState(null, "", url);
  };
  async function mutate(action: string, payload: unknown) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const result = await requestJSON<{ data: Trip }>(
        `/api/v1/itineraries/${trip.id}/`,
        "PATCH",
        { version: trip.version, action, payload },
      );
      setTrip(result.data);
      onUpdated(result.data);
      if (action === "add")
        captureInterest("place_added_to_itinerary", {
          place_id: (payload as { place_id: string }).place_id,
        });
      notify(
        action === "add"
          ? "Place added to your itinerary."
          : "Itinerary saved.",
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const findDestinations = () => {
    setView("plan");
    requestAnimationFrame(() => {
      const searchToggle = document.getElementById(
        "planner-search-destination",
      );
      if (searchToggle?.getAttribute("aria-expanded") === "false")
        searchToggle.click();
      const finder = document.getElementById("find-destinations");
      finder?.scrollIntoView({ block: "start" });
      finder
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus({ preventScroll: true });
    });
  };
  const exploreMap = async () => {
    if (busy) return;
    if (!trip.area_id) {
      setEdit(true);
      notify("Choose an area for this trip first.");
      return;
    }
    if (
      dirtyNotes.current.size &&
      !(await ask(
        "Discard unsaved stop notes or times before browsing destinations?",
      ))
    )
      return;
    dirtyNotes.current.clear();
    onDirtyChange(false);
    router.push(`/itineraries/explore/?trip=${trip.id}&day=${day.id}`);
  };
  const reorder = async (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= stops.length || from === to) return false;
    const order = stops.map((s) => s.id);
    order.splice(to, 0, order.splice(from, 1)[0]);
    return mutate("reorder", { day_id: day.id, item_ids: order });
  };
  const changeStop = async (
    item: TripItem,
    action: "move" | "remove",
    dayId?: string,
  ) => {
    const dirty =
      dirtyNotes.current.has(item.id) ||
      dirtyNotes.current.has(item.id + ":time");
    if (
      dirty &&
      !(await ask("Discard unsaved notes or times for this destination?"))
    )
      return false;
    const saved = await mutate(action, {
      item_id: item.id,
      ...(dayId ? { day_id: dayId } : {}),
    });
    if (saved) {
      dirtyNotes.current.delete(item.id);
      dirtyNotes.current.delete(item.id + ":time");
      onDirtyChange(dirtyNotes.current.size > 0);
    }
    return saved;
  };
  const exportReady = () => {
    if (dirtyNotes.current.size) {
      notify(
        "Save your stop notes and times before printing or downloading.",
        true,
      );
      return false;
    }
    return true;
  };
  return (
    <>
      {dialog}
      <header className="p2-section-head p2-trip-header">
        <div>
          <span className="p2-eyebrow">
            {tripDateLabel(trip.start_date, trip.end_date)} ·{" "}
            {trip.itinerary_days.length} {trip.itinerary_days.length === 1 ? "day" : "days"}
          </span>
          <h1>{trip.title}</h1>
          {trip.areas && <p className="p2-muted">{trip.areas.name}</p>}
          {trip.notes && <p className="p2-trip-notes">{trip.notes}</p>}
        </div>
        <div className="p2-actions">
          <button
            className="p2-button p2-button--quiet"
            disabled={busy || !exportMounted}
            aria-busy={!exportMounted}
            onClick={() => {
              if (exportReady()) downloadItinerary(trip.title);
            }}
          >
            Download trip
          </button>
          <button
            className="p2-button p2-button--quiet"
            disabled={busy || !exportMounted}
            aria-busy={!exportMounted}
            onClick={() => {
              if (exportReady()) window.print();
            }}
          >
            Print itinerary
          </button>
          <button
            className="p2-button p2-button--quiet"
            onClick={() => setEdit(true)}
            disabled={busy}
          >
            Edit trip
          </button>
          <button
            className="p2-icon"
            aria-label="Delete itinerary"
            data-tooltip="Delete itinerary"
            disabled={busy}
            onClick={async () => {
              if (!(await ask(`Delete “${trip.title}” and its stops?`))) return;
              setBusy(true);
              try {
                await requestJSON(`/api/v1/itineraries/${trip.id}/`, "DELETE", {
                  version: trip.version,
                });
                onDeleted();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            ×
          </button>
        </div>
      </header>
      {error && (
        <div className="p2-error" role="alert">
          <p>{error}</p>
          <button
            className="p2-button p2-button--quiet"
            disabled={busy}
            onClick={async () => {
              try {
                const r = await requestJSON<{ data: Trip }>(
                  `/api/v1/itineraries/${trip.id}/`,
                );
                setTrip(r.data);
                onUpdated(r.data);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Reload plan
          </button>
        </div>
      )}
      <nav className="p2-day-tabs" aria-label="Itinerary days">
        {trip.itinerary_days.map((d) => (
          <button
            key={d.id}
            className={`p2-button p2-button--quiet${day.id === d.id ? " p3-day-selected" : ""}`}
            aria-pressed={day.id === d.id}
            aria-current={day.id === d.id ? "date" : undefined}
            disabled={busy}
            onClick={() => changeDay(d.id)}
          >
            {dayLabel(d, trip.start_date)}
            <small>
              {day.id === d.id && (
                <span className="p3-day-current-label">Selected · </span>
              )}
              {trip.items.filter((i) => i.day_id === d.id).length}{" "}
              {trip.items.filter((i) => i.day_id === d.id).length === 1
                ? "stop"
                : "stops"}
            </small>
          </button>
        ))}
        <button
          className="p2-button p2-button--quiet"
          disabled={busy || trip.itinerary_days.length >= 60}
          onClick={() => void mutate("add_day", {})}
        >
          + Add day
        </button>
      </nav>
      <h2 className="p2-planner-day-heading">
        {dayLabel(day, trip.start_date)}
      </h2>
      <div className="p2-view-tabs" role="group" aria-label="Planner view">
        <button
          className="p2-button p2-button--quiet"
          aria-pressed={view === "plan"}
          onClick={() => setView("plan")}
        >
          Final itinerary
        </button>
        <button
          className="p2-button p2-button--quiet"
          aria-pressed={view === "map"}
          onClick={() => {
            setView("map");
          }}
        >
          My route
        </button>
      </div>
      <div className={`p2-planner p2-planner--${view} p2-planner--focused`}>
        <section
          className="p2-day-plan"
          aria-label={dayLabel(day, trip.start_date)}
        >
          <p
            className="p2-drag-announcement p2-sr-only"
            role="status"
            aria-live="polite"
          >
            {drag
              ? `Moving ${stops.find((s) => s.id === drag.id)?.place?.title || "destination"}. Position ${stops.findIndex((s) => s.id === drag.over) + 1} of ${stops.length}. Release to save, or Escape to cancel.`
              : ""}
          </p>
          <fieldset disabled={busy} className="p2-fieldset" aria-busy={busy}>
            <ol className="p2-stops">
              {stops.map((item, index) => (
                <li
                  id={`stop-${item.id}`}
                  tabIndex={-1}
                  key={item.id}
                  className="p2-stop"
                  data-stop-index={index}
                  data-planner-stop={item.id}
                  data-dragging={drag?.id === item.id || undefined}
                  data-drop-target={
                    (drag?.over === item.id && drag.id !== item.id) || undefined
                  }
                >
                  <span
                    className="p2-stop-number"
                    aria-label={`Stop ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                  <PlannerStopActions
                    name={item.place?.title || "Unavailable destination"}
                    itemId={item.id}
                    dayId={day.id}
                    days={trip.itinerary_days}
                    first={index === 0}
                    last={index === stops.length - 1}
                    busy={busy}
                    onUp={() => reorder(index, index - 1)}
                    onDown={() => reorder(index, index + 1)}
                    onMove={(id) => changeStop(item, "move", id)}
                    onRemove={() => changeStop(item, "remove")}
                    onDrag={(target) =>
                      setDrag(target ? { id: item.id, over: target } : null)
                    }
                    onDrop={(target) =>
                      void reorder(
                        index,
                        stops.findIndex((s) => s.id === target),
                      )
                    }
                  />
                  <div className="p2-stop-body">
                    <div className="p2-stop-heading">
                      {item.place?.image && (
                        <ContentImage sizes="96px"
                          src={item.place.image}
                          alt=""
                          loading="lazy"
                        />
                      )}
                      <div>
                        <span className="p2-eyebrow">
                          {item.place?.area || "Saved stop"}
                        </span>
                        <h3>
                          {item.place ? (
                            <a
                              href={`/place/${item.place.slug}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.place.title} ↗
                            </a>
                          ) : (
                            "Place unavailable"
                          )}
                        </h3>
                        <p className="p2-muted">
                          {item.place?.category ||
                            "Your notes remain saved. This Place may be unpublished or restricted."}
                        </p>
                      </div>
                    </div>
                    <StopTiming
                      item={item}
                      conflicts={stops.filter((s) => s.id !== item.id)}
                      onSave={(time) =>
                        mutate("schedule", { item_id: item.id, ...time })
                      }
                      onDirtyChange={(dirty) => {
                        const key = item.id + ":time";
                        if (dirty) dirtyNotes.current.add(key);
                        else dirtyNotes.current.delete(key);
                        onDirtyChange(dirtyNotes.current.size > 0);
                      }}
                    />
                    <StopNotes
                      item={item}
                      onDirtyChange={(dirty) => {
                        if (dirty) dirtyNotes.current.add(item.id);
                        else dirtyNotes.current.delete(item.id);
                        onDirtyChange(dirtyNotes.current.size > 0);
                      }}
                      onSave={(notes) =>
                        mutate("notes", { item_id: item.id, notes })
                      }
                    />
                  </div>
                </li>
              ))}
            </ol>
          </fieldset>
          <DaySchedule
            stops={stops}
            onStop={(id) => {
              const el = document.getElementById(`stop-${id}`);
              el?.scrollIntoView({ block: "center" });
              el?.focus({ preventScroll: true });
            }}
          />
          {!stops.length && (
            <p className="p2-muted">
              No stops yet. Find your first destination below. Your plan saves
              as you go.
            </p>
          )}
          {!trip.area_id ? (
            <div className="p2-empty">
              <h3>Choose your trip area</h3>
              <p>
                Your existing stops are saved. Choose one area before adding
                destinations.
              </p>
              <button className="p2-button" onClick={() => setEdit(true)}>
                Choose area
              </button>
            </div>
          ) : (
            <PlaceSearch
              catalog={catalog}
              filtered={filteredPlaces}
              filters={filters}
              onFiltersChange={(values) =>
                setFilters((current) => ({ ...current, ...values }))
              }
              onExploreMap={exploreMap}
              day={dayLabel(day, trip.start_date)}
              busy={busy}
              addedPlaceIds={stops.map((s) => s.place_id)}
              onAdd={async (p) => {
                chooseStop(p);
                return true;
              }}
            />
          )}
        </section>
        <aside
          ref={mapPanel}
          tabIndex={-1}
          className="p2-plan-map p2-plan-map--stops"
          aria-label="Selected day map"
        >
          <h2>My route</h2>
          <div className="p2-plan-map-actions">
            <button
              className="p2-button p2-button--quiet"
              onClick={findDestinations}
            >
              Add destination
            </button>
          </div>
          {
            <PalawanMap
              planning={{
                places: locations,
                numbered: true,
                onSelect: (p) => {
                  setView("plan");
                  const item = stops.find((s) => s.place_id === p.id);
                  setTimeout(() => {
                    const el = document.getElementById(`stop-${item?.id}`);
                    el?.scrollIntoView({ block: "center" });
                    el?.focus();
                  }, 0);
                },
              }}
            />
          }
        </aside>
      </div>
      {adding && (
        <Modal
          title={`Add ${adding.title}`}
          onClose={() => {
            if (!busy) setAdding(null);
          }}
        >
          <p className="p2-muted">
            {dayLabel(day, trip.start_date)} · Choose an optional time for this
            visit.
          </p>
          <ValidatedForm
            className="p2-form"
            data-backend="true"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate("add", {
                  day_id: day.id,
                  place_id: adding.id,
                  ...visitTime,
                })
              )
                setAdding(null);
            }}
          >
            <fieldset disabled={busy} className="p2-fieldset">
              <StopTimeFields value={visitTime} onChange={setVisitTime} />
              {overlappingStops([
                ...stops,
                { id: "new-stop", ...visitTime },
              ]).has("new-stop") && (
                <p className="p2-schedule-warning" role="status">
                  This visit overlaps another stop on this day. You can still
                  add it or choose another time.
                </p>
              )}
            </fieldset>
            {error && (
              <p className="p2-error" role="alert">
                {error}
              </p>
            )}
            <div className="p2-actions">
              <button className="p2-button" disabled={busy}>
                {busy ? "Adding…" : "Add Place"}
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
      {edit && (
        <Modal title="Edit trip details" onClose={() => setEdit(false)}>
          <TripForm
            trip={trip}
            onSaved={(t) => {
              setTrip(t);
              onUpdated(t);
              setEdit(false);
              notify("Trip details saved.");
            }}
            onCancel={() => setEdit(false)}
          />
        </Modal>
      )}
      <PrintableItinerary trip={trip} onReady={setExportMounted} />
    </>
  );
}
