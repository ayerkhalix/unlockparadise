"use client";
import { useEffect, useRef, useState } from "react";
import { MAPBOX_TOKEN } from "./palawan-map";
import { Icon } from "./icon";
import { labelMapControls } from "@/lib/map-accessibility";
import { notify } from "@/lib/client-api";
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
  const [copied, setCopied] = useState(false);
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
          The satellite map is unavailable. The coordinates and Maps link are
          available below.
        </p>
      )}
      <section
        className="destination-directions"
        aria-label="Destination location"
      >
        <h3>Destination coordinates</h3>
        <div className="upd-place__mapfoot">
          <button
            type="button"
            className={`upd-coords${copied ? " upd-coords--copied" : ""}`}
            aria-label={
              copied
                ? "Copied destination coordinates"
                : `Copy destination coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}`
            }
            data-tooltip="Copy destination coordinates"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${lat}, ${lng}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {
                notify(
                  "Could not copy. You can select the coordinates shown here.",
                  true,
                );
              }
            }}
          >
            {copied ? "Copied" : `${lat.toFixed(6)}, ${lng.toFixed(6)}`}
          </button>
          <a
            className="upd-maps-btn"
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="Location" size={16} />
            Open in Maps
          </a>
        </div>
      </section>
      {accessPoints.length > 0 && (
        <section className="access-location-list" aria-label="Access points">
          <p className="access-map-legend">
            <span>Gold pin: destination</span>
            <span>Teal square: access point</span>
          </p>
          <h3>Getting there: jump-off / access points</h3>
          <ul>
            {accessPoints.map((point, i) => (
              <li key={i}>
                <strong>{point.name}</strong>
                <span>{point.type}</span>
                {point.directions && <p>{point.directions}</p>}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}
                >
                  Open in Maps
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
