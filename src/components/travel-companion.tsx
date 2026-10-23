"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "./ui/modal";
import { SavedPlaces, useSavedPlaces } from "./bucketlist";
import { ItineraryPicker } from "./itinerary-picker";
import { Icon } from "./icon";
import { FlightCount } from "./ui/flight-count";
import { FloatingDock } from "./ui/floating-dock";
export function TravelCompanion({ tier }: { tier: string }) {
  const [drawer, setDrawer] = useState(false),
    [place, setPlace] = useState<string | null>(null);
  const pathname = usePathname();
  const { rows, loading, error, reload } = useSavedPlaces(
    tier === "explorer-plus",
  );
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const button = (e.target as Element).closest<HTMLElement>(
        "[data-add-itinerary]",
      );
      if (button?.dataset.addItinerary) {
        setDrawer(false);
        setPlace(button.dataset.addItinerary);
      }
    };
    document.addEventListener("click", click);
    const pending = new URLSearchParams(location.search).get("add_place");
    if (pending && /^[0-9a-f-]{36}$/i.test(pending)) {
      const timer = setTimeout(() => setPlace(pending), 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", click);
      };
    }
    return () => document.removeEventListener("click", click);
  }, []);
  const hidden =
    /^\/(admin|auth|merch|login|join|forgot-password|reset-password|checkout|traveler-discovery)(\/|$)/.test(
      pathname,
    );
  return (
    <>
      {!hidden && (
        <FloatingDock>
          <button
            className="p2-floating"
            data-flight-target="bucketlist"
            data-tooltip="Open Bucketlist"
            type="button"
            aria-label={`Open Bucketlist ${loading ? "loading" : error ? "unavailable" : `${rows.length} saved Places`}`}
            onClick={() => setDrawer(true)}
          >
            <Icon name="Bucket" size={22} />
            <span>Bucketlist</span>{" "}
            <FlightCount value={loading ? "…" : error ? "—" : rows.length} />
          </button>
        </FloatingDock>
      )}
      {drawer && (
        <Modal title="My Bucketlist" onClose={() => setDrawer(false)} drawer>
          {tier === "public" ? (
            <div className="p2-empty">
              <h3>Keep a little paradise for later.</h3>
              <p>
                Sign in to access your saved Places. Bucketlist is an Explorer+
                feature.
              </p>
              <a href="/login/?redirect_to=/bucketlist/" className="p2-button">
                Sign in
              </a>
            </div>
          ) : tier !== "explorer-plus" ? (
            <div className="p2-empty">
              <h3>Save with Explorer+</h3>
              <p>
                Keep your favorite Places together with an Explorer+ membership.
              </p>
              <a className="p2-button" href="/membership/">
                Explore membership
              </a>
              <a href="/itineraries/" className="p2-button p2-button--quiet">
                Plan a trip
              </a>
            </div>
          ) : loading ? (
            <p role="status">Loading saved Places…</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <button className="p2-button" onClick={reload}>
                Try again
              </button>
            </div>
          ) : rows.length ? (
            <>
              <p className="p2-muted">
                {rows.length} ideas for your next escape
              </p>
              <SavedPlaces rows={rows} compact />
              <a className="p2-button p2-full" href="/bucketlist/">
                Open full Bucketlist
              </a>
            </>
          ) : (
            <div className="p2-empty">
              <h3>Your next adventure starts here.</h3>
              <p>Tap “Add to Bucketlist” on a destination to keep it close.</p>
              <a href="/" className="p2-button">
                Discover Palawan
              </a>
            </div>
          )}
        </Modal>
      )}
      {place &&
        (tier === "public" ? (
          <Modal title="Plan your next escape" onClose={() => setPlace(null)}>
            <p>Sign in to add this Place to an itinerary.</p>
            <a
              className="p2-button"
              href={`/login/?redirect_to=${encodeURIComponent(`/itineraries/?add_place=${place}`)}`}
            >
              Sign in to continue
            </a>
          </Modal>
        ) : (
          <ItineraryPicker
            placeId={place}
            onClose={() => {
              setPlace(null);
              if (new URLSearchParams(location.search).has("add_place")) {
                const url = new URL(location.href);
                url.searchParams.delete("add_place");
                history.replaceState(null, "", url);
              }
            }}
          />
        ))}
    </>
  );
}
