"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TripForm } from "./trip-form";
import { ItineraryPlanner } from "./itinerary-planner";
import { Modal } from "./ui/modal";
import { useDecision } from "./ui/decision";
import { notify } from "@/lib/client-api";
import { plannerHref, type Trip } from "@/lib/planning";

export function ItineraryWorkspace({
  initial,
  selected,
  create = false,
}: {
  initial: Trip[];
  selected?: Trip;
  create?: boolean;
}) {
  const router = useRouter();
  const [trips, setTrips] = useState(initial);
  const [creating, setCreating] = useState(create && !!selected);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const { ask, dialog } = useDecision();
  const canLeave = async () =>
    !dirty ||
    !!(await ask(
      "Discard unsaved stop notes or visit times before leaving this trip?",
    ));
  const openTrip = (trip: Trip) => {
    notify("Trip created. Add your first destination.");
    startTransition(() => router.push(plannerHref(trip.id)));
  };
  const closeCreate = () => {
    setCreating(false);
    if (new URLSearchParams(location.search).has("create")) {
      const url = new URL(location.href);
      url.searchParams.delete("create");
      history.replaceState(null, "", url);
    }
  };
  return (
    <div className="p2-workspace">
      {dialog}
      <div className="p2-workspace-toolbar">
        <div className="p2-workspace-label">Itinerary Planner</div>
        {selected && (
          <div className="p2-workspace-controls">
            <label className="p2-trip-switcher">
              Switch trip
              <select
                aria-label="Switch trip"
                value={selected.id}
                disabled={pending || saving}
                onChange={async (e) => {
                  const id = e.target.value;
                  if (id !== selected.id && (await canLeave()))
                    startTransition(() => router.push(plannerHref(id)));
                }}
              >
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="p2-button p2-button--quiet"
              disabled={pending || saving}
              onClick={async () => {
                if (await canLeave()) setCreating(true);
              }}
            >
              + New trip
            </button>
          </div>
        )}
      </div>
      <p className="p2-workspace-status p2-muted" role="status">
        {pending
          ? "Opening your trip…"
          : saving
            ? "Saving your plan…"
            : dirty
              ? "You have unsaved stop notes or visit times."
              : ""}
      </p>
      {selected ? (
        <div inert={pending} aria-busy={pending}>
          <ItineraryPlanner
            initial={selected}
            onDirtyChange={setDirty}
            onBusyChange={setSaving}
            onUpdated={(updated) =>
              setTrips((rows) =>
                rows.map((trip) => (trip.id === updated.id ? updated : trip)),
              )
            }
            onDeleted={() =>
              startTransition(() => {
                router.replace("/itineraries/");
                router.refresh();
              })
            }
          />
        </div>
      ) : (
        <section className="p2-first-trip">
          <div>
            <h1>Plan your first Palawan trip.</h1>
            <p className="p2-muted">
              Give it a name, choose one area and set your dates. You can add destinations,
              explore the map and adjust the details as you go.
            </p>
            <a className="p2-back" href="/#palawan-map">
              Explore destinations on the map ↗
            </a>
          </div>
          <div>
            <h2>Create a trip</h2>
            <TripForm onSaved={openTrip} />
          </div>
        </section>
      )}
      {creating && selected && (
        <Modal title="Create a new trip" onClose={closeCreate}>
          <p className="p2-muted">
            Your current itinerary stays saved. Give your next adventure a name.
          </p>
          <TripForm onSaved={openTrip} onCancel={closeCreate} />
        </Modal>
      )}
    </div>
  );
}
