"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { TravelPlace } from "@/lib/planning";
import { MAPBOX_TOKEN } from "./palawan-map";
import { labelMapControls } from "@/lib/map-accessibility";
import { accessMarker } from "@/lib/access-markers";
export type PlanningMapProps = {
  places: TravelPlace[];
  onSelect: (place: TravelPlace) => void;
  numbered?: boolean;
  addedPlaceIds?: string[];
  busy?: boolean;
  selectionLabel?: string;
  browseHeader?: ReactNode;
};
export function PlanningMap({
  places,
  onSelect,
  numbered = false,
  addedPlaceIds = [],
  busy = false,
  selectionLabel = "Add to selected day",
  browseHeader,
}: PlanningMapProps) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const [selected, setSelected] = useState<TravelPlace | null>(null);
  const located = places.filter((p) => p.coordinates);
  useEffect(() => {
    let disposed = false;
    let instance: MapboxMap | undefined;
    let observer: ResizeObserver | undefined;
    const timeout = setTimeout(() => {
      if (!disposed) setError(true);
    }, 20000);
    void import("mapbox-gl")
      .then(({ default: mb }) => {
        if (disposed || !host.current) return;
        if (!mb.supported()) {
          setError(true);
          return;
        }
        mb.accessToken = MAPBOX_TOKEN;
        try {
          instance = new mb.Map({
            container: host.current,
            style: "mapbox://styles/mapbox/satellite-v9",
            center: [118.9, 10.2],
            zoom: 7,
            cooperativeGestures: true,
          });
          map.current = instance;
          instance
            .getCanvas()
            .setAttribute(
              "aria-label",
              numbered ? "Itinerary stop map" : "Destination selection map",
            );
          observer = new ResizeObserver(() => instance?.resize());
          observer.observe(host.current);
          instance.addControl(
            new mb.NavigationControl({ showCompass: false }),
            "top-right",
          );
          labelMapControls(host.current);
          instance.on("load", () => {
            clearTimeout(timeout);
            if (!disposed) {
              setReady(true);
              setError(false);
            }
          });
          instance.on("error", () => {
            if (!disposed) setError(true);
          });
        } catch {
          setError(true);
        }
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      observer?.disconnect();
      instance?.remove();
      map.current = null;
    };
  }, [numbered]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    const markers: { remove: () => void }[] = [];
    void import("mapbox-gl").then(({ default: mb }) => {
      if (disposed || !map.current) return;
      places.forEach((p, index) => {
        if (!p.coordinates) return;
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "button");
        button.className = "p2-map-marker";
        button.textContent = numbered ? String(index + 1) : "●";
        button.setAttribute(
          "aria-label",
          `${numbered ? `Stop ${index + 1}: ` : ""}${p.title}`,
        );
        button.addEventListener("click", () => {
          setSelected(p);
          map.current?.flyTo({
            center: p.coordinates!,
            zoom: 12,
            essential: false,
          });
        });
        markers.push(
          new mb.Marker({ element: button })
            .setLngLat(p.coordinates)
            .addTo(map.current!),
        );
      });
      const coords = places.filter((p) => p.coordinates);
      if (coords.length) {
        const bounds = new mb.LngLatBounds();
        coords.forEach((p) => bounds.extend(p.coordinates!));
        map.current.fitBounds(bounds, {
          padding: 60,
          maxZoom: 13,
          animate: false,
        });
      }
    });
    return () => {
      disposed = true;
      markers.forEach((m) => m.remove());
    };
  }, [places, ready, numbered]);
  useEffect(() => {
    if (
      !ready ||
      !map.current ||
      !selected ||
      !places.some((p) => p.id === selected.id)
    )
      return;
    let disposed = false;
    const markers: { remove: () => void }[] = [];
    void import("mapbox-gl").then(({ default: mb }) => {
      if (disposed || !map.current) return;
      const points = selected.accessPoints || [];
      points.forEach((point, index) =>
        markers.push(
          new mb.Marker({
            element: accessMarker(
              point,
              () =>
                map.current?.easeTo({
                  center: [point.longitude, point.latitude],
                  zoom: 14,
                  duration: 0,
                }),
              index % 2 ? "above" : "below",
            ),
          })
            .setLngLat([point.longitude, point.latitude])
            .addTo(map.current!),
        ),
      );
      if (points.length) {
        const bounds = new mb.LngLatBounds();
        if (selected.coordinates) bounds.extend(selected.coordinates);
        points.forEach((p) => bounds.extend([p.longitude, p.latitude]));
        map.current.fitBounds(bounds, {
          padding: 75,
          maxZoom: 13,
          animate: false,
        });
      }
    });
    return () => {
      disposed = true;
      markers.forEach((m) => m.remove());
    };
  }, [ready, selected, places]);
  return (
    <div className="p2-planning-map">
      <div
        ref={host}
        className="p2-map-canvas"
        role="region"
        aria-label={numbered ? "Itinerary map" : "Destination map"}
      />
      {!ready && !error && (
        <p className="p2-map-notice" role="status">
          Loading map… Destination choices remain available in this card.
        </p>
      )}
      {error && (
        <p className="p2-map-notice" role="status">
          Map tiles are unavailable. Use the destination choices in this card.
        </p>
      )}
      <div className="p2-map-caption">
        {located.length} mapped {located.length === 1 ? "place" : "places"} ·
        Locations, not navigation routes
      </div>
      <div
        className="p2-map-browser"
        data-dock-clearance
        aria-label={numbered ? "Route stops" : "Category destinations"}
      >
        {browseHeader}
        {selected && places.some((p) => p.id === selected.id) ? (
          <article className="p2-map-preview">
            <button
              type="button"
              className="p2-button p2-button--quiet"
              onClick={() => setSelected(null)}
            >
              ← Back to destinations
            </button>
            {selected.image && (
              <img
                className="p2-map-preview__photo"
                src={selected.image}
                alt=""
              />
            )}
            <div>
              <h3>{selected.title}</h3>
              <p>{selected.area}</p>
              {!selected.coordinates && (
                <p className="p2-muted">Map location not yet verified.</p>
              )}
              {!!selected.accessPoints?.length && (
                <details>
                  <summary>
                    Getting there · {selected.accessPoints.length} access points
                  </summary>
                  <p className="access-map-legend">
                    Teal square pins: access points
                  </p>
                  <ul>
                    {selected.accessPoints.map((p, i) => (
                      <li key={i}>
                        {p.type}: {p.name}
                        {p.directions && <p>{p.directions}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <a
                href={`/place/${selected.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Place ↗
              </a>
            </div>
            <button
              type="button"
              className="p2-button"
              disabled={
                busy || (!numbered && addedPlaceIds.includes(selected.id))
              }
              onClick={() => onSelect(selected)}
            >
              {numbered
                ? "View stop"
                : addedPlaceIds.includes(selected.id)
                  ? "Added to this day"
                  : busy
                    ? "Saving stop…"
                    : selectionLabel}
            </button>
          </article>
        ) : (
          <details className="p2-map-list" open={!numbered || undefined}>
            <summary>
              {numbered ? "Route stops" : `Destinations (${places.length})`}
            </summary>
            {places.length ? (
              places.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    if (p.coordinates)
                      map.current?.flyTo({
                        center: p.coordinates,
                        zoom: 12,
                        essential: false,
                      });
                  }}
                >
                  {p.image && !numbered && (
                    <img src={p.image} alt="" loading="lazy" />
                  )}
                  <span>
                    {numbered ? `${i + 1}. ` : ""}
                    {p.title}
                    <small>
                      {addedPlaceIds.includes(p.id) && !numbered
                        ? "Added to this day"
                        : p.category}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <p>Your route will appear here when you add a destination.</p>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
