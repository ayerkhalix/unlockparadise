"use client";
import { captureInterest } from "@/lib/analytics-client";
import { safeLibraryReturn } from "@/lib/itinerary-library";
import { ValidatedForm } from "./ui/validated-form";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import {
  notify,
  notifyUndo,
  requestJSON,
  RequestFailure,
} from "@/lib/client-api";
import { TripForm } from "./trip-form";
import { useDecision } from "./ui/decision";
import { Modal } from "./ui/modal";
import { PlaceSearch, type PlaceSearchFilters } from "./place-search";
import { PalawanMap } from "./palawan-map";
import { usePlanningCatalog } from "./use-planning-catalog";
import { StopTimeFields } from "./stop-time-fields";
import {
  TripSchedule,
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
  const [time, setTime] = useState<StopTime>(initial);
  const dirty =
    time.start_time !== initial.start_time ||
    time.end_time !== initial.end_time;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
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
            onDirtyChange(false);
          }
        }}
      >
        <StopTimeFields
          value={time}
          onChange={(value) => {
            setTime(value);
            onDirtyChange(
              value.start_time !== initial.start_time ||
                value.end_time !== initial.end_time,
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
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
function StopNotes({
  item,
  onSave,
  onDirtyChange,
}: {
  item: TripItem;
  onSave: (notes: string) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [notes, setNotes] = useState(item.notes);
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const saved = item.notes;
  const dirty = notes !== saved;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  return (
    <div className="p2-stop-notes p3-stop-note-editor">
      <ValidatedForm
        data-backend="true"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave(notes)) {
            onDirtyChange(false);
          }
        }}
      >
        <label htmlFor={`stop-notes-${item.id}`}>
          <Icon name="Notes" size={14} /> Notes for this stop
        </label>
        <textarea
          id={`stop-notes-${item.id}`}
          className="resize-none"
          disabled={!ready}
          maxLength={2000}
          rows={2}
          placeholder="What would you like to remember?"
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
    </div>
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
  onUpdated?: (trip: Trip) => void;
  onDeleted: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const dirtyNotes = useRef(new Set<string>());
  const [hasDrafts, setHasDrafts] = useState(false);
  const reportDirty = (dirty: boolean) => {
    setHasDrafts(dirty);
    onDirtyChange(dirty);
  };
  const [exportMounted, setExportMounted] = useState(false);
  const [trip, setTrip] = useState(initial);
  const tripRef = useRef(initial),
    mutationLock = useRef(false);
  const failedMutation = useRef<{ action: string; payload: unknown } | null>(
      null,
    ),
    failureText = useRef("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
      "saved",
    ),
    [requiresReload, setRequiresReload] = useState(false),
    [canRetrySave, setCanRetrySave] = useState(false);
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
  const searchParams = useSearchParams();
  const requestedDay = searchParams.get("day");
  const requestedView = searchParams.get("view");
  const { ask, dialog } = useDecision();
  const [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [view, updateView] = useState(
      requestedView === "map" || requestedView === "schedule"
        ? requestedView
        : "plan",
    ),
    [drag, setDrag] = useState<{ id: string; over: string } | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const setView = (next: string) => {
    updateView(next);
    const url = new URL(location.href);
    url.searchParams.set("view", next);
    history.replaceState(null, "", url);
  };
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
        tripRef.current = next;
        setTrip(next);
        onUpdated?.(next);
      }
    };
    window.addEventListener("upd:itinerary-saved", updated);
    return () => window.removeEventListener("upd:itinerary-saved", updated);
  }, [initial.id, onUpdated]);
  const changeDay = async (id: string) => {
    if (id === day.id) return true;
    if (
      dirtyNotes.current.size &&
      !(await ask("Discard unsaved stop notes or times before switching days?"))
    )
      return false;
    dirtyNotes.current.clear();
    reportDirty(false);
    const url = new URL(location.href);
    url.searchParams.set("trip", trip.id);
    url.searchParams.set("day", id);
    history.replaceState(null, "", url);
    return true;
  };
  async function mutate(action: string, payload: unknown, quiet = false) {
    if (mutationLock.current) {
      failureText.current =
        "A save is still in progress. Try Undo again when it finishes.";
      return false;
    }
    mutationLock.current = true;
    setBusy(true);
    setSaveState("saving");
    setError("");
    try {
      const result = await requestJSON<{ data: Trip }>(
        `/api/v1/itineraries/${trip.id}/`,
        "PATCH",
        { version: tripRef.current.version, action, payload },
      );
      if (
        action === "delete_day" &&
        !result.data.itinerary_days.some((d) => d.id === day.id)
      ) {
        const oldIndex = trip.itinerary_days.findIndex((d) => d.id === day.id);
        const nextDay =
          result.data.itinerary_days[
            Math.min(oldIndex, result.data.itinerary_days.length - 1)
          ];
        const url = new URL(location.href);
        url.searchParams.set("day", nextDay.id);
        history.replaceState(null, "", url);
      }
      tripRef.current = result.data;
      setTrip(result.data);
      onUpdated?.(result.data);
      window.dispatchEvent(
        new CustomEvent("upd:itinerary-saved", { detail: result.data }),
      );
      failedMutation.current = null;
      setSaveState("saved");
      setRequiresReload(false);
      if (action === "add")
        captureInterest("place_added_to_itinerary", {
          place_id: (payload as { place_id: string }).place_id,
        });
      if (!quiet)
        notify(
          action === "add"
            ? "Place added to your itinerary."
            : action === "delete_day"
              ? "Day deleted. Your remaining days and dates are updated."
              : "Itinerary saved.",
        );
      return true;
    } catch (e) {
      failedMutation.current = quiet ? null : { action, payload };
      setCanRetrySave(!quiet);
      failureText.current = (e as Error).message;
      setSaveState("error");
      setRequiresReload(e instanceof RequestFailure && e.status === 409);
      setError((e as Error).message);
      if (!quiet) notify((e as Error).message, true);
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
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
    reportDirty(false);
    const query = new URLSearchParams({ trip: trip.id, day: day.id });
    const library = safeLibraryReturn(searchParams.get("return_to"));
    if (library) query.set("return_to", library);
    router.push(`/itineraries/explore/?${query}`);
  };
  const reorder = async (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= stops.length || from === to) return false;
    if (dirtyNotes.current.size) {
      if (
        !(await ask(
          "Discard unsaved notes or times before rearranging? Destinations will use their new position’s time slot.",
        ))
      )
        return false;
      dirtyNotes.current.clear();
      reportDirty(false);
      setDraftRevision((n) => n + 1);
    }
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
      reportDirty(dirtyNotes.current.size > 0);
      if (action === "remove")
        notifyUndo(
          `${item.place?.title || "Destination"} removed from your itinerary.`,
          async () => {
            const restored = await mutate(
              "restore",
              {
                day_id: item.day_id,
                place_id: item.place_id,
                position: item.position,
                notes: item.notes,
                start_time: item.start_time?.slice(0, 5) || null,
                end_time: item.end_time?.slice(0, 5) || null,
              },
              true,
            );
            if (!restored)
              throw new Error(
                failureText.current ||
                  "Could not restore this stop. Try Undo again.",
              );
            notify("Destination restored with its notes and visit time.");
          },
        );
    }
    return saved;
  };
  const deleteDay = async (id: string) => {
    if (busy || dirtyNotes.current.size || trip.itinerary_days.length <= 1)
      return;
    const target = trip.itinerary_days.find((d) => d.id === id);
    if (!target) return;
    const count = trip.items.filter((item) => item.day_id === id).length;
    const newEnd = trip.start_date
      ? new Date(
          Date.parse(trip.start_date + "T00:00:00Z") +
            (trip.itinerary_days.length - 2) * 86400000,
        )
          .toISOString()
          .slice(0, 10)
      : null;
    if (
      !(await ask(
        `Delete ${dayLabel(target, trip.start_date)} and its ${count} ${count === 1 ? "stop" : "stops"}? Saved notes and visit times for this day will be removed. Later days shift earlier. ${newEnd ? `Your trip will run ${tripDateLabel(trip.start_date, newEnd)}.` : `Your trip will have ${trip.itinerary_days.length - 1} days.`}`,
      ))
    )
      return;
    await mutate("delete_day", { day_id: id });
  };
  const deleteTrip = async () => {
    if (
      mutationLock.current ||
      !(await ask(
        `Delete “${trip.title}” and all of its days, stops, notes and visit times?`,
      ))
    )
      return;
    mutationLock.current = true;
    setBusy(true);
    try {
      await requestJSON(`/api/v1/itineraries/${trip.id}/`, "DELETE", {
        version: tripRef.current.version,
      });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, true);
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
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
            {trip.itinerary_days.length}{" "}
            {trip.itinerary_days.length === 1 ? "day" : "days"}
          </span>
          <h1>{trip.title}</h1>
          <p
            className="p2-save-feedback"
            role="status"
            aria-live="polite"
            data-state={saveState}
          >
            {saveState === "saving"
              ? "Saving changes…"
              : saveState === "error"
                ? "Changes not saved"
                : hasDrafts
                  ? "Unsaved notes or times"
                  : "Saved"}
          </p>
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
        </div>
      </header>
      {error && (
        <div className="p2-error" role="alert">
          <p>{error}</p>
          {saveState === "error" && !requiresReload && canRetrySave && (
            <button
              className="p2-button p2-button--quiet"
              disabled={busy}
              onClick={() => {
                const failed = failedMutation.current;
                if (failed) void mutate(failed.action, failed.payload);
              }}
            >
              Retry save
            </button>
          )}
          <button
            className="p2-button p2-button--quiet"
            disabled={busy}
            onClick={async () => {
              try {
                const r = await requestJSON<{ data: Trip }>(
                  `/api/v1/itineraries/${trip.id}/`,
                );
                tripRef.current = r.data;
                setTrip(r.data);
                failedMutation.current = null;
                setSaveState("saved");
                setRequiresReload(false);
                onUpdated?.(r.data);
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
      <div className="p2-view-tabs" role="group" aria-label="Planner view">
        <button
          className="p2-button p2-button--quiet"
          aria-pressed={view === "plan"}
          onClick={() => setView("plan")}
        >
          Itinerary
        </button>
        <button
          className="p2-button p2-button--quiet"
          aria-pressed={view === "schedule"}
          onClick={() => setView("schedule")}
        >
          Schedule
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
      <nav
        hidden={view === "schedule"}
        className="p2-day-tabs"
        aria-label="Itinerary days"
      >
        {trip.itinerary_days.map((d) => (
          <div className="planner-day-tab" key={d.id}>
            <button
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
            <button
              type="button"
              className="planner-delete-day"
              aria-label={`Delete ${dayLabel(d, trip.start_date)}`}
              data-tooltip={
                hasDrafts
                  ? "Save your notes and times first"
                  : trip.itinerary_days.length === 1
                    ? "Keep at least one day"
                    : `Delete ${dayLabel(d, trip.start_date)}`
              }
              disabled={busy || hasDrafts || trip.itinerary_days.length === 1}
              onClick={() => void deleteDay(d.id)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
              </svg>
            </button>
          </div>
        ))}
        <button
          className="p2-button p2-button--quiet"
          disabled={busy || trip.itinerary_days.length >= 60}
          onClick={() => void mutate("add_day", {})}
        >
          + Add day
        </button>
      </nav>
      <h2 hidden={view === "schedule"} className="p2-planner-day-heading">
        {dayLabel(day, trip.start_date)}
      </h2>
      <div className={`p2-planner p2-planner--${view} p2-planner--focused`}>
        <section
          hidden={view !== "plan"}
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
                        <ContentImage
                          sizes="96px"
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
                      key={`${item.id}:${item.start_time}:${item.end_time}:${draftRevision}`}
                      item={item}
                      conflicts={stops.filter((s) => s.id !== item.id)}
                      onSave={(time) =>
                        mutate("schedule", { item_id: item.id, ...time })
                      }
                      onDirtyChange={(dirty) => {
                        const key = item.id + ":time";
                        if (dirty) dirtyNotes.current.add(key);
                        else dirtyNotes.current.delete(key);
                        reportDirty(dirtyNotes.current.size > 0);
                      }}
                    />
                    <StopNotes
                      key={`${item.id}:${draftRevision}`}
                      item={item}
                      onDirtyChange={(dirty) => {
                        if (dirty) dirtyNotes.current.add(item.id);
                        else dirtyNotes.current.delete(item.id);
                        reportDirty(dirtyNotes.current.size > 0);
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
          {!stops.length && (
            <p className="p2-muted">
              No stops yet. Find your first destination below. Your plan saves
              as you go.
            </p>
          )}
        </section>
        <section
          hidden={view !== "schedule"}
          className="planner-schedule-panel"
        >
          <TripSchedule
            trip={trip}
            onStop={async (targetDay, id) => {
              if (!(await changeDay(targetDay.id))) return;
              setView("plan");
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const el = document.getElementById(`stop-${id}`);
                  el?.scrollIntoView({ block: "center" });
                  el?.focus({ preventScroll: true });
                }),
              );
            }}
          />
        </section>
        <aside
          hidden={view !== "map"}
          ref={mapPanel}
          tabIndex={-1}
          className="p2-plan-map p2-plan-map--stops"
          aria-label="Selected day map"
        >
          <h2>My route</h2>
          <PalawanMap
            planning={{
              places: locations,
              numbered: true,
              onSelect: (p) => {
                setView("plan");
                const item = stops.find((s) => s.place_id === p.id);
                requestAnimationFrame(() => {
                  const el = document.getElementById(`stop-${item?.id}`);
                  el?.scrollIntoView({ block: "center" });
                  el?.focus({ preventScroll: true });
                });
              },
            }}
          />
        </aside>
      </div>
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
          dayPicker={
            view === "schedule" ? (
              <label className="planner-search-day">
                Add destinations to
                <select
                  value={day.id}
                  disabled={busy}
                  onChange={(event) => void changeDay(event.target.value)}
                >
                  {trip.itinerary_days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {dayLabel(d, trip.start_date)}
                    </option>
                  ))}
                </select>
              </label>
            ) : undefined
          }
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
        <Modal
          title="Edit trip details"
          onClose={() => {
            if (!busy) setEdit(false);
          }}
        >
          <TripForm
            trip={trip}
            onDelete={deleteTrip}
            onSaved={(t) => {
              tripRef.current = t;
              failedMutation.current = null;
              setSaveState("saved");
              setError("");
              setTrip(t);
              onUpdated?.(t);
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
