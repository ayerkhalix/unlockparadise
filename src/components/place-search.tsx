"use client";
import { ContentImage } from "@/components/ui/content-image";

import { SearchInput } from "./ui/search-input";
import { useState } from "react";
import { Icon } from "./icon";
import type { TravelPlace } from "@/lib/planning";
import type { PlanningCatalog } from "./use-planning-catalog";
import { useSavedPlaces } from "./bucketlist";
import { BucketlistButton } from "./bucketlist-button";

export type PlaceSearchFilters = {
  search: string;
};

export function PlaceSearch({
  day,
  onAdd,
  busy,
  addedPlaceIds,
  catalog,
  filtered,
  filters: { search },
  onFiltersChange,
  onExploreMap,
  dayPicker,
}: {
  day: string;
  onAdd: (place: TravelPlace) => Promise<boolean>;
  busy: boolean;
  addedPlaceIds: string[];
  catalog: PlanningCatalog;
  filtered: TravelPlace[];
  filters: PlaceSearchFilters;
  onFiltersChange: (values: Partial<PlaceSearchFilters>) => void;
  onExploreMap: () => void;
  dayPicker?: React.ReactNode;
}) {
  const bucketlist = useSavedPlaces(true);
  const saved = new Set(
    bucketlist.rows.filter((row) => row.saved_at).map((row) => row.place_id),
  );
  const { loading } = catalog;
  const [error, setError] = useState("");
  const add = async (p: TravelPlace) => {
    setError("");
    try {
      if (!(await onAdd(p)))
        setError(
          "Could not add this destination. Check the plan and try again.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section
      className="p2-destination-finder"
      aria-label="Find destinations"
      id="find-destinations"
    >
      <h3>Add destination</h3>
      {dayPicker}
      <div className="p2-destination-choices">
        <label className="planner-inline-search">
          <span className="p2-sr-only">Search destinations</span>
          <Icon name="Search" size={20} />
          <SearchInput
            label="Search destinations"
            value={search}
            onValueChange={(value) => onFiltersChange({ search: value })}
            placeholder="Search destination"
          />
        </label>
        <button
          disabled={busy}
          className="p2-button p2-button--quiet"
          onClick={onExploreMap}
        >
          <Icon name="Explore" size={23} />
          Explore options
        </button>
      </div>
      <fieldset
        id="planner-destination-search"
        disabled={busy}
        className="p2-fieldset p2-form"
        aria-busy={busy}
      >
        {loading ? (
          <p role="status">Loading destinations…</p>
        ) : (
          <>
            {(error || catalog.error) && (
              <div className="p2-error" role="alert">
                <p>{error || catalog.error}</p>
                <button
                  type="button"
                  className="p2-button p2-button--quiet"
                  onClick={() => {
                    setError("");
                    catalog.reload();
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            <p className="p2-muted" role="status">
              {filtered.length} matching destinations
              {busy ? " · Saving stop…" : ""}
            </p>
            {!filtered.length && !error && !catalog.error ? (
              <div className="p2-empty">
                <h3>No destinations found</h3>
                <p>
                  Try another name or clear your search. Destination choices
                  stay within your trip area.
                </p>
                <button
                  type="button"
                  className="p2-button p2-button--quiet"
                  onClick={() => {
                    onFiltersChange({ search: "" });
                  }}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <ul
                className="p2-search-results"
                onKeyDown={(e) => {
                  if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
                  const items = Array.from(
                    e.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button[data-place-choice]:not(:disabled)",
                    ),
                  );
                  const index = items.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  if (index < 0 || !items.length) return;
                  e.preventDefault();
                  items[
                    (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                      items.length
                  ]?.focus();
                }}
              >
                {filtered.map((p) => {
                  const added = addedPlaceIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      {p.image && (
                        <ContentImage
                          sizes="96px"
                          src={p.image}
                          alt=""
                          loading="lazy"
                        />
                      )}
                      <div>
                        <strong>{p.title}</strong>
                        <p>
                          {[p.area, p.category].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="p2-button p2-button--quiet"
                        data-place-choice
                        disabled={added}
                        aria-label={
                          added
                            ? `Added: ${p.title} is already in ${day}`
                            : `Add ${p.title} to ${day}`
                        }
                        onClick={() => void add(p)}
                      >
                        {added ? "Added" : "+ Add"}
                      </button>
                      <BucketlistButton
                        placeId={p.id}
                        saved={saved.has(p.id)}
                        loading={bucketlist.loading || !!bucketlist.error}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </fieldset>
      {bucketlist.error && (
        <p className="p2-error" role="status">
          Bucketlist is unavailable.{" "}
          <button type="button" onClick={() => void bucketlist.reload()}>
            Retry Bucketlist
          </button>
        </p>
      )}
    </section>
  );
}
