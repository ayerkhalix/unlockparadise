"use client";
import { ContentImage } from "@/components/ui/content-image";

import { SearchInput } from "./ui/search-input";
import { useRef, useState } from "react";
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
}) {
  const section = useRef<HTMLElement>(null);
  const bucketlist = useSavedPlaces(true);
  const saved = new Set(
    bucketlist.rows.filter((row) => row.saved_at).map((row) => row.place_id),
  );
  const { loading } = catalog;
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(6);
  const [expanded, setExpanded] = useState(false);
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
      ref={section}
      className="p2-destination-finder"
      aria-label="Find destinations"
      id="find-destinations"
    >
      <h3>Add destination</h3>
      <div className="p2-destination-choices">
        <button
          id="planner-search-destination"
          className="p2-button p2-button--quiet"
          aria-expanded={expanded}
          aria-controls="planner-destination-search"
          onClick={() => {
            setExpanded((value) => !value);
            if (!expanded)
              requestAnimationFrame(() =>
                section.current
                  ?.querySelector<HTMLInputElement>('input[type="search"]')
                  ?.focus(),
              );
          }}
        >
          <Icon name="Search" size={23} />
          Search destination
        </button>
        <button className="p2-button p2-button--quiet" onClick={onExploreMap}>
          <Icon name="Explore" size={23} />
          Explore options
        </button>
      </div>
      <fieldset
        id="planner-destination-search"
        hidden={!expanded}
        disabled={busy}
        className="p2-fieldset p2-form"
        aria-busy={busy}
      >
        <label>
          Search destinations
          <SearchInput
            label="Search destinations"
            value={search}
            onValueChange={(value) => {
              onFiltersChange({ search: value });
              setLimit(6);
            }}
            placeholder="Search by destination name"
          />
        </label>
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
                    setLimit(6);
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
                {filtered.slice(0, limit).map((p) => {
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
            {filtered.length > limit && (
              <button
                type="button"
                className="p2-button p2-button--quiet"
                onClick={() => setLimit(limit + 12)}
              >
                Show more destinations
              </button>
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
