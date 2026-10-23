"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AreaMap, type MapConfiguration } from "./palawan-map";
import { PlanningMap } from "./planning-map";
import { planningMapData, placesInMapCategory } from "@/lib/planning-map-data";
import type { TravelPlace } from "@/lib/planning";

export function PlannerDiscoveryMap({
  places,
  onSelect,
  addedPlaceIds,
  busy,
  day,
  metadata,
}: {
  places: TravelPlace[];
  onSelect: (place: TravelPlace) => void;
  addedPlaceIds: string[];
  busy: boolean;
  day: string;
  metadata?: Pick<MapConfiguration, "areas" | "categories">;
}) {
  const data = useMemo(
    () => planningMapData(places, metadata),
    [places, metadata],
  );
  const [browse, setBrowse] = useState<{
    area: string;
    category: string;
  } | null>(null);
  const [returnArea, setReturnArea] = useState<string | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (browse) heading.current?.focus({ preventScroll: true });
  }, [browse]);
  const area = data.areas.find((a) => a.name === returnArea);
  const selectedPlaces = useMemo(
    () =>
      browse ? placesInMapCategory(places, browse.area, browse.category) : [],
    [browse, places],
  );
  return (
    <section className="p2-mini-map" aria-label="Explore the planner map">
      {browse ? (
        <>
          {selectedPlaces.length ? (
            <PlanningMap
              browseHeader={
                <div
                  className="p2-mini-map__heading"
                  ref={heading}
                  tabIndex={-1}
                >
                  <button
                    type="button"
                    className="p2-button p2-button--quiet"
                    onClick={() => {
                      setReturnArea(browse.area);
                      setBrowse(null);
                    }}
                  >
                    Back to {browse.area} categories
                  </button>
                  <h3>
                    {browse.area} · {browse.category}
                  </h3>
                </div>
              }
              places={selectedPlaces}
              onSelect={onSelect}
              addedPlaceIds={addedPlaceIds}
              busy={busy}
              selectionLabel={`Add to ${day}`}
            />
          ) : (
            <div>
              <button
                className="p2-button p2-button--quiet"
                onClick={() => {
                  setReturnArea(browse.area);
                  setBrowse(null);
                }}
              >
                Back to {browse.area} categories
              </button>
              <p role="status">
                No destinations match these filters. Go back to choose another
                area or category.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="p2-muted">
            Choose an area, then a category to discover destinations for {day}.
          </p>
          <AreaMap
            data={data}
            compact
            initialArea={area}
            onChooseCategory={(selectedArea, category) =>
              setBrowse({ area: selectedArea.name, category: category.name })
            }
          />
        </>
      )}
    </section>
  );
}
