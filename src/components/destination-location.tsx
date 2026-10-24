"use client";
import { useEffect, useRef, useState } from "react";
import { MAPBOX_TOKEN } from "./palawan-map";
import { labelMapControls } from "@/lib/map-accessibility";
import type { AccessPoint } from "@/lib/access-points";
import { accessMarker } from "@/lib/access-markers";
const noAccessPoints: AccessPoint[] = [];

export function DestinationLocation({
  coordinates,
  zoom: requestedZoom = 14,
  accessPoints = noAccessPoints,
}: {
  coordinates: [number, number];
  zoom?: number;
  accessPoints?: AccessPoint[];
}) {
  const zoom = Math.max(1, Math.min(20, requestedZoom));
  const container = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [lng, lat] = coordinates;
  useEffect(() => {
    let disposed = false;
    let map: import("mapbox-gl").Map | undefined;
    void import("mapbox-gl")
      .then(({ default: mapbox }) => {
        if (disposed || !container.current) return;
        if (!mapbox.supported()) {
          setUnavailable(true);
          return;
        }
        mapbox.accessToken = MAPBOX_TOKEN;
        map = new mapbox.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/satellite-v9",
          center: [lng, lat],
          zoom,
          cooperativeGestures: false,
        });
        map.addControl(
          new mapbox.NavigationControl({ showCompass: false }),
          "top-right",
        );
        labelMapControls(container.current);
        map.on("error", () => {
          if (!disposed) setUnavailable(true);
        });
        new mapbox.Marker({ color: "#d4a344" })
          .setLngLat([lng, lat])
          .addTo(map);
        if (accessPoints.length) {
          const bounds = new mapbox.LngLatBounds().extend([lng, lat]);
          accessPoints.forEach((point, index) => {
            const coords: [number, number] = [point.longitude, point.latitude];
            new mapbox.Marker({
              element: accessMarker(
                point,
                () =>
                  map?.easeTo({
                    center: coords,
                    zoom: 14,
                    duration: matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? 0
                      : 300,
                  }),
                index % 2 ? "above" : "below",
              ),
            })
              .setLngLat(coords)
              .addTo(map!);
            bounds.extend(coords);
          });
          map.fitBounds(bounds, { padding: 90, maxZoom: 14, animate: false });
        }
        map.on("load", () =>
          container.current?.setAttribute("data-map-ready", "true"),
        );
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [lng, lat, zoom, accessPoints]);
  return (
    <>
      <div
        className="place-map-embed"
        id="place-map-1"
        ref={container}
        data-lat={lat}
        data-lng={lng}
        data-zoom={zoom}
        role="region"
        aria-label="Destination satellite map"
      />
      {unavailable && (
        <p className="phase1-pending">
          The satellite map is unavailable. Use the Maps links below for
          directions.
        </p>
      )}
      <section className="destination-directions" aria-label="Getting there">
        <h3>Getting there</h3>
        <dl className="destination-map-links">
          {accessPoints.map((point, i) => (
            <div key={i}>
              <dt>{point.type}:</dt>
              <dd>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${point.name} in Maps`}
                  data-tooltip={point.name}
                  href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}
                >
                  Open in Maps
                </a>
                {point.directions && <p>{point.directions}</p>}
              </dd>
            </div>
          ))}
          <div>
            <dt>Destination:</dt>
            <dd>
              <a
                aria-label="Open destination in Maps"
                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Maps
              </a>
            </dd>
          </div>
        </dl>
        {accessPoints.length > 0 && (
          <p className="access-map-legend">
            <span>Gold pin: destination</span>
            <span>Teal square: access point</span>
          </p>
        )}
      </section>
    </>
  );
}
