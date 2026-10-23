"use client";
import { useEffect, useRef, useState } from "react";
import { labelMapControls } from "@/lib/map-accessibility";
export function CoordinatePicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: string;
  longitude: string;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const handler = useRef(onPick);
  const initial = useRef({ latitude, longitude });
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    handler.current = onPick;
  }, [onPick]);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;
    let disposed = false;
    let map: import("mapbox-gl").Map | undefined;
    let observer: ResizeObserver | undefined;
    void import("mapbox-gl")
      .then(({ default: mapbox }) => {
        if (disposed || !node.current) return;
        mapbox.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
        map = new mapbox.Map({
          container: node.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [
            initial.current.longitude !== ""
              ? Number(initial.current.longitude)
              : 118.75,
            initial.current.latitude !== ""
              ? Number(initial.current.latitude)
              : 9.9,
          ],
          zoom: 9,
        });
        labelMapControls(node.current);
        mapRef.current = map;
        setReady(true);
        observer = new ResizeObserver(() => map?.resize());
        observer.observe(node.current);
        map.on("click", (e) => handler.current(e.lngLat.lat, e.lngLat.lng));
        map.on("error", () =>
          setMessage("Map unavailable. Enter coordinates above."),
        );
      })
      .catch(() => setMessage("Map unavailable. Enter coordinates above."));
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let active = true;
    const lat = Number(latitude),
      lng = Number(longitude);
    if (
      !latitude ||
      !longitude ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    void import("mapbox-gl").then(({ default: mb }) => {
      if (!active || !mapRef.current) return;
      markerRef.current?.remove();
      markerRef.current = new mb.Marker().setLngLat([lng, lat]).addTo(map);
      map.jumpTo({ center: [lng, lat] });
    });
    return () => {
      active = false;
    };
  }, [latitude, longitude, ready]);
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
    <>
      <p>Click the map to set coordinates.</p>
      <div ref={node} style={{ height: 300 }} />
      <p role="status">{message}</p>
    </>
  ) : (
    <p>
      Enter coordinates above. Configure the Mapbox browser token to enable the
      map picker.
    </p>
  );
}
