"use client";
import { ContentImage } from "@/components/ui/content-image";
import { localImageAspectRatio } from "@/lib/image-delivery";

/* eslint-disable @next/next/no-location-assign-relative-destination -- The source archive enhancement owns document-level filter/history state; preserve its full-page navigation contract. */

import { useEffect, useId, useRef, useState } from "react";
import type { Map as MapboxMap, LngLat, LngLatBounds } from "mapbox-gl";
import staticMapData from "@/data/map.json";
import { PlanningMap, type PlanningMapProps } from "./planning-map";
import { labelMapControls } from "@/lib/map-accessibility";
import { MapFeedback } from "./map-feedback";
import { useSearchParams } from "next/navigation";

export interface MapConfiguration {
  areas: { name: string; slug: string; coords: number[]; desc: string }[];
  categories: {
    name: string;
    slug: string;
    image: string;
    imageAspectRatio?: number;
  }[];
  availability: Record<string, Record<string, number>>;
  categoryCounts?: Record<string, number>;
}
type Area = MapConfiguration["areas"][number];
function categoryPhotoSizes(
  category: MapConfiguration["categories"][number],
  compact: boolean,
) {
  if (compact) return "(max-width: 767px) 40vw, 220px";
  const aspect =
    category.imageAspectRatio || localImageAspectRatio(category.image) || 4 / 3;
  const square = Math.max(1, aspect);
  const portrait = Math.max(1, aspect * 1.5);
  return `(max-width: 767px) ${48 * square}vw, (max-width: 1199px) ${16 * portrait}vw, ${180 * portrait}px`;
}
type SavedView = { center: LngLat; zoom: number; bounds: LngLatBounds | null };
const configuredMapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
export const MAPBOX_TOKEN = configuredMapboxToken?.startsWith("pk.")
  ? configuredMapboxToken
  : "";

export function PalawanMap({
  data,
  planning,
}: {
  data?: MapConfiguration;
  planning?: PlanningMapProps;
}) {
  return planning ? <PlanningMap {...planning} /> : <AreaMap data={data} />;
}
export function AreaMap({
  data: mapData = staticMapData,
  compact = false,
  initialArea,
  onChooseCategory,
}: {
  data?: MapConfiguration;
  compact?: boolean;
  initialArea?: Area;
  onChooseCategory?: (
    area: Area,
    category: MapConfiguration["categories"][number],
  ) => void;
}) {
  const uniqueId = useId();
  const titleId = compact ? `${uniqueId}-area-name` : "overlay-area-name";
  const AreaHeading = compact ? "h3" : "h2";
  const selectAreaRef = useRef<((area: Area) => void) | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const savedView = useRef<SavedView | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const escapeLink = useRef<HTMLAnchorElement>(null);
  const query = useSearchParams();
  const returnArea = query.get("map_area");
  const returnPage = query.get("map_page");
  const [selected, setSelected] = useState<Area | null>(
    () =>
      initialArea ||
      (!compact && returnArea
        ? mapData.areas.find((area) => area.slug === returnArea)
        : null) ||
      null,
  );
  const [page, setPage] = useState(!compact && returnPage === "1" ? 1 : 0);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (compact || !returnArea) return;
    const area = mapData.areas.find((item) => item.slug === returnArea);
    if (!area) return;
    void Promise.resolve().then(() => {
      setSelected(area);
      setPage(returnPage === "1" ? 1 : 0);
    });
  }, [compact, returnArea, returnPage, mapData]);
  const drag = useRef({ x: 0, y: 0, dy: 0, axis: "", active: false });

  useEffect(() => {
    let disposed = false;
    const timeout = setTimeout(() => {
      if (!disposed) setUnavailable(true);
    }, 20000);
    let map: MapboxMap | undefined;
    let glowFrame = 0;
    let overlayTimer: ReturnType<typeof setTimeout>;
    let resizeTimer: ReturnType<typeof setTimeout>;
    let observer: IntersectionObserver | undefined;
    let sizeObserver: ResizeObserver | undefined;
    let resize: (() => void) | undefined;
    const targets: HTMLButtonElement[] = [];
    async function initialize() {
      const mapbox = (await import("mapbox-gl")).default;
      if (disposed || !container.current) return;
      if (!mapbox.supported()) {
        setUnavailable(true);
        return;
      }
      mapbox.accessToken = MAPBOX_TOKEN;
      try {
        map = new mapbox.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/satellite-v9",
          bounds: [
            [117.75, 8.35],
            [119.55, 11.3],
          ],
          fitBoundsOptions: { padding: 20, animate: false },
          pitch: 0,
          bearing: 0,
          maxBounds: [
            [114.3, 4.8],
            [122.7, 14.7],
          ],
          minZoom: 2,
          maxZoom: 17,
          dragPan: true,
          scrollZoom: true,
          boxZoom: true,
          doubleClickZoom: true,
          touchZoomRotate: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          keyboard: true,
          cooperativeGestures: compact,
        });
      } catch {
        setUnavailable(true);
        return;
      }
      mapRef.current = map;
      if (compact) {
        sizeObserver = new ResizeObserver(() => map?.resize());
        sizeObserver.observe(container.current);
      }
      map
        .getCanvas()
        .setAttribute(
          "aria-label",
          compact ? "Planner area map" : "Palawan area map",
        );
      map.addControl(
        new mapbox.NavigationControl({ showCompass: false }),
        "top-right",
      );
      labelMapControls(container.current);
      let touched = false,
        lastHeight = container.current.clientHeight;
      ["mousedown", "touchstart", "wheel", "keydown"].forEach((event) =>
        map!.getContainer().addEventListener(
          event,
          () => {
            touched = true;
          },
          { passive: true },
        ),
      );
      resize = () => {
        if (
          !map ||
          touched ||
          Math.abs(map.getContainer().clientHeight - lastHeight) < 40
        )
          return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!map || touched) return;
          lastHeight = map.getContainer().clientHeight;
          map.fitBounds(
            [
              [117.75, 8.35],
              [119.55, 11.3],
            ],
            { padding: 20, animate: false },
          );
        }, 200);
      };
      window.addEventListener("resize", resize, { passive: true });
      map.on("error", (event) => {
        if (/401|403|token|WebGL/i.test(event.error.message))
          setUnavailable(true);
      });
      map.on("load", () => {
        if (!map || disposed) return;
        clearTimeout(timeout);
        setReady(true);
        setUnavailable(false);
        container.current?.setAttribute("data-map-ready", "true");
        map.addSource("areas", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: mapData.areas.flatMap((area, id) =>
              area.coords.length !== 2
                ? []
                : [
                    {
                      type: "Feature",
                      id,
                      geometry: { type: "Point", coordinates: area.coords },
                      properties: {
                        name: area.name,
                        slug: area.slug,
                        desc: area.desc,
                      },
                    },
                  ],
            ),
          },
        });
        map.addLayer({
          id: "areas-hit",
          type: "circle",
          source: "areas",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7,
              30,
              11,
              40,
            ],
            "circle-color": "#000",
            "circle-opacity": 0,
          },
        });
        map.addLayer({
          id: "areas-glow",
          type: "circle",
          source: "areas",
          paint: {
            "circle-radius": 12,
            "circle-color": "rgba(232,213,183,0.15)",
            "circle-blur": 0.8,
          },
        });
        map.addLayer({
          id: "areas-dot",
          type: "circle",
          source: "areas",
          paint: {
            "circle-radius": 6,
            "circle-color": "#fff3dc",
            "circle-stroke-width": 3,
            "circle-stroke-color": "rgba(255,235,200,0.85)",
          },
        });

        function selectArea(area: Area) {
          if (!map) return;
          touched = true;
          savedView.current = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            bounds: map.getMaxBounds(),
          };
          map.setMaxZoom(14);
          map.setMaxBounds(undefined);
          map.flyTo({
            center: area.coords as [number, number],
            zoom: 14,
            bearing: 30,
            duration: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 1500,
            essential: false,
          });
          clearTimeout(overlayTimer);
          overlayTimer = setTimeout(
            () => {
              if (!disposed) {
                setSelected(area);
                setPage(0);
              }
            },
            compact || matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 800,
          );
        }
        selectAreaRef.current = selectArea;
        mapData.areas.forEach((area, id) => {
          if (area.coords.length !== 2) return;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-area-target";
          button.setAttribute("role", "button");
          button.setAttribute("aria-label", `Explore ${area.name}`);
          const label = document.createElement("span");
          label.textContent = area.name;
          button.appendChild(label);
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            selectArea(area);
          });
          button.addEventListener("mouseenter", () => {
            hovered = id;
            lastHovered = id;
            targetRadius = 24;
            targetOpacity = 0.4;
            targetDot = 9;
            label.style.textShadow = "0 0 8px rgba(232,213,183,.8)";
            if (!glowFrame) glowFrame = requestAnimationFrame(animateGlow);
          });
          button.addEventListener("mouseleave", () => {
            hovered = null;
            targetRadius = 12;
            targetOpacity = 0.15;
            targetDot = 6;
            label.style.textShadow = "";
            if (!glowFrame) glowFrame = requestAnimationFrame(animateGlow);
          });
          new mapbox.Marker({ element: button, anchor: "center" })
            .setLngLat(area.coords as [number, number])
            .addTo(map!);
          targets.push(button);
        });
        const syncLabels = () =>
          targets.forEach((target) => {
            target.firstElementChild!.setAttribute(
              "style",
              `opacity:${map!.getZoom() >= 7.6 ? 1 : 0}`,
            );
          });
        map.on("zoom", syncLabels);
        syncLabels();
        let hovered: number | null = null,
          lastHovered: number | null = null;
        let radius = 12,
          opacity = 0.15,
          dot = 6;
        let targetRadius = 12,
          targetOpacity = 0.15,
          targetDot = 6;
        function animateGlow() {
          if (!map || disposed) return;
          radius += (targetRadius - radius) * 0.08;
          opacity += (targetOpacity - opacity) * 0.08;
          dot += (targetDot - dot) * 0.08;
          const id = hovered ?? lastHovered;
          if (id !== null) {
            map.setPaintProperty("areas-glow", "circle-radius", [
              "case",
              ["==", ["id"], id],
              radius,
              12,
            ]);
            map.setPaintProperty("areas-glow", "circle-color", [
              "case",
              ["==", ["id"], id],
              `rgba(232,213,183,${opacity.toFixed(3)})`,
              "rgba(232,213,183,0.15)",
            ]);
            map.setPaintProperty("areas-dot", "circle-radius", [
              "case",
              ["==", ["id"], id],
              dot,
              6,
            ]);
          }
          if (
            Math.abs(radius - targetRadius) > 0.1 ||
            Math.abs(dot - targetDot) > 0.1
          )
            glowFrame = requestAnimationFrame(animateGlow);
          else {
            glowFrame = 0;
            if (hovered === null) {
              map.setPaintProperty("areas-glow", "circle-radius", 12);
              map.setPaintProperty("areas-dot", "circle-radius", 6);
              lastHovered = null;
            }
          }
        }
        map.on("mousemove", "areas-hit", (event) => {
          if (!map) return;
          map.getCanvas().style.cursor = "pointer";
          const id = Number(event.features?.[0]?.id);
          if (!Number.isFinite(id) || id === hovered) return;
          hovered = id;
          lastHovered = id;
          targetRadius = 24;
          targetOpacity = 0.4;
          targetDot = 9;
          if (!glowFrame) glowFrame = requestAnimationFrame(animateGlow);
        });
        map.on("mouseleave", "areas-hit", () => {
          if (!map) return;
          map.getCanvas().style.cursor = "";
          hovered = null;
          targetRadius = 12;
          targetOpacity = 0.15;
          targetDot = 6;
          if (!glowFrame) glowFrame = requestAnimationFrame(animateGlow);
        });
        map.on("click", "areas-hit", (event) => {
          const id = Number(event.features?.[0]?.id);
          if (mapData.areas[id]) selectArea(mapData.areas[id]);
        });
        observer = new IntersectionObserver(
          (entries) =>
            entries.forEach((entry) =>
              escapeLink.current?.classList.toggle(
                "is-hidden",
                entry.intersectionRatio < 0.5,
              ),
            ),
          { threshold: [0, 0.25, 0.5, 0.75, 1] },
        );
        observer.observe(container.current!);
      });
    }
    const start = () =>
      void initialize().catch(() => {
        if (!disposed) setUnavailable(true);
      });
    const activation =
      !compact && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                activation?.disconnect();
                start();
              }
            },
            { rootMargin: "400px" },
          )
        : null;
    if (activation && container.current) activation.observe(container.current);
    else start();
    return () => {
      disposed = true;
      activation?.disconnect();
      clearTimeout(timeout);
      clearTimeout(overlayTimer);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(glowFrame);
      observer?.disconnect();
      sizeObserver?.disconnect();
      if (resize) window.removeEventListener("resize", resize);
      map?.remove();
      mapRef.current = null;
      selectAreaRef.current = null;
    };
  }, [mapData, compact, attempt]);

  function close() {
    setSelected(null);
    if (!compact) {
      const url = new URL(location.href);
      url.searchParams.delete("map_area");
      url.searchParams.delete("map_page");
      history.replaceState(null, "", url);
    }
    setTimeout(() => {
      const map = mapRef.current,
        saved = savedView.current;
      if (!map || !saved) return;
      map.flyTo({
        center: saved.center,
        zoom: saved.zoom,
        bearing: 0,
        pitch: 0,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 1200,
        essential: false,
      });
      map.once("moveend", () => {
        map.setMaxZoom(12);
        map.setMaxBounds(saved.bounds ?? undefined);
      });
    }, 200);
  }
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!compact && returnArea)
      container.current?.scrollIntoView({ block: "start" });
    if (!compact) document.body.style.overflow = "hidden";
    rail.current?.scrollTo({
      left: !compact && returnPage === "1" ? rail.current.clientWidth : 0,
      behavior: "instant",
    });
    panel.current?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        if (!compact) {
          const url = new URL(location.href);
          url.searchParams.delete("map_area");
          url.searchParams.delete("map_page");
          history.replaceState(null, "", url);
        }
        const map = mapRef.current,
          saved = savedView.current;
        if (map && saved) {
          map.flyTo({
            center: saved.center,
            zoom: saved.zoom,
            bearing: 0,
            duration: 1200,
          });
          map.setMaxBounds(saved.bounds ?? undefined);
        }
      }
      if (compact || event.key !== "Tab") return;
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        ) || [],
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      if (!compact) document.body.style.overflow = "";
      document.removeEventListener("keydown", keys);
      previous?.focus({ preventScroll: true });
    };
  }, [selected, compact, returnPage, returnArea]);

  const available = selected
    ? (mapData.availability as Record<string, Record<string, number>>)[
        selected.slug
      ]
    : null;
  const categories = mapData.categories.filter(
    (cat) => !available || available[cat.slug],
  );
  const pages = Array.from(
    { length: Math.ceil(categories.length / 6) },
    (_, i) => categories.slice(i * 6, i * 6 + 6),
  );
  const tile = (cat: (typeof categories)[number]) => (
    <button
      className="category-btn"
      type="button"
      key={cat.slug}
      data-cat={cat.slug}
      onClick={() => {
        if (selected) {
          if (onChooseCategory) onChooseCategory(selected, cat);
          else {
            const url = new URL(location.href);
            url.searchParams.set("map_area", selected.slug);
            if (page) url.searchParams.set("map_page", String(page));
            else url.searchParams.delete("map_page");
            history.replaceState(null, "", url);
            window.location.assign(`/area/${selected.slug}/${cat.slug}/`);
          }
        }
      }}
    >
      {cat.image && (
        <ContentImage
          sizes={categoryPhotoSizes(cat, compact)}
          className="category-thumb"
          src={cat.image}
          alt=""
          loading="eager"
          fetchPriority="low"
        />
      )}
      <span className="category-label">{cat.name}</span>
    </button>
  );
  return (
    <div
      className={compact ? "p2-area-map-compact" : "p2-main-area-map"}
      data-map-attempt={attempt}
    >
      <div className="palawan-map-wrap" style={{ position: "relative" }}>
        <div
          id={compact ? undefined : "palawan-map"}
          className={compact ? "p2-area-map-canvas" : undefined}
          role="region"
          ref={container}
          aria-label="Interactive Palawan destination map"
        />
        <MapFeedback
          loading={!ready && !unavailable}
          error={unavailable}
          className="map-unavailable"
          retry={() => {
            setReady(false);
            setUnavailable(false);
            setAttempt((n) => n + 1);
          }}
        >
          {compact ? (
            "Choose an area below to keep exploring."
          ) : (
            <>
              Browse an area:{" "}
              {mapData.areas.map((area) => (
                <button
                  type="button"
                  className="map-fallback-area"
                  key={area.slug}
                  aria-label={`Explore ${area.name}`}
                  onClick={() =>
                    selectAreaRef.current
                      ? selectAreaRef.current(area)
                      : setSelected(area)
                  }
                >
                  {area.name}
                </button>
              ))}
            </>
          )}
        </MapFeedback>
        {!compact && (
          <div className="upd-map-escape-dock">
            <a
              ref={escapeLink}
              className={`upd-map-escape is-hidden${selected ? " is-suppressed" : ""}`}
              href="#featured"
            >
              ↓ Featured destinations
            </a>
          </div>
        )}
      </div>
      {compact && (
        <div className="p2-map-areas" role="group" aria-label="Choose an area">
          {mapData.areas.map((area) => (
            <button
              type="button"
              key={area.slug}
              className="p2-button p2-button--quiet"
              aria-pressed={selected?.slug === area.slug}
              onClick={() =>
                selectAreaRef.current
                  ? selectAreaRef.current(area)
                  : setSelected(area)
              }
            >
              {area.name}
            </button>
          ))}
        </div>
      )}
      <div
        className={`map-overlay${selected ? " active" : ""}`}
        id={compact ? undefined : "map-overlay"}
        aria-hidden={!selected}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        inert={!selected}
      >
        <div
          className="category-panel"
          ref={panel}
          role={compact ? "region" : "dialog"}
          aria-modal={compact ? undefined : true}
          aria-labelledby={titleId}
          tabIndex={-1}
          onTouchStart={(event) => {
            if (compact) return;
            drag.current = {
              x: event.touches[0].clientX,
              y: event.touches[0].clientY,
              dy: 0,
              axis: "",
              active: true,
            };
          }}
          onTouchMove={(event) => {
            if (compact) return;
            const d = drag.current;
            const dx = event.touches[0].clientX - d.x,
              dy = event.touches[0].clientY - d.y;
            if (!d.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
              d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (d.axis === "y" && dy > 0) {
              d.dy = dy;
              event.currentTarget.style.transform = `translateY(${dy}px)`;
            }
          }}
          onTouchEnd={(event) => {
            if (compact) return;
            event.currentTarget.style.transform = "";
            if (drag.current.dy > 90) close();
            drag.current.active = false;
          }}
        >
          <span className="sheet-handle" />
          <AreaHeading id={titleId}>{selected?.name}</AreaHeading>
          <div
            className="area-subtitle"
            id={compact ? undefined : "overlay-area-desc"}
          >
            {selected?.desc}
          </div>
          <div
            className="category-buttons"
            ref={rail}
            style={
              {
                "--cat-rows": Math.max(
                  1,
                  Math.ceil(Math.min(categories.length, 6) / 2),
                ),
              } as React.CSSProperties
            }
            onScroll={(event) =>
              setPage(
                Math.round(
                  event.currentTarget.scrollLeft /
                    event.currentTarget.clientWidth,
                ),
              )
            }
          >
            {selected
              ? pages.map((cats, i) => (
                  <div className="category-page" key={i}>
                    {cats.map(tile)}
                  </div>
                ))
              : categories.map(tile)}
          </div>
          <div
            className="category-dots"
            id={compact ? undefined : "category-dots"}
            hidden={!selected || pages.length <= 1}
          >
            {selected &&
              pages.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  className={`category-dot${page === i ? " is-active" : ""}`}
                  aria-label={`Page ${i + 1} of ${pages.length}`}
                  onClick={() =>
                    rail.current?.scrollTo({
                      left: rail.current.clientWidth * i,
                      behavior: matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "instant"
                        : "smooth",
                    })
                  }
                />
              ))}
          </div>
          <button
            type="button"
            className="back-btn"
            id={compact ? undefined : "overlay-back"}
            onClick={close}
          >
            Back to Map
          </button>
        </div>
      </div>
    </div>
  );
}
