"use client";
import { SearchInput } from "./ui/search-input";
import { useRef, useState } from "react";
import type { TravelPlace } from "@/lib/planning";
import type { PlanningCatalog } from "./use-planning-catalog";

export type PlaceSearchFilters = {
  search: string;
  area: string;
  category: string;
};

export function PlaceSearch({
  day,
  onAdd,
  busy,
  addedPlaceIds,
  catalog,
  filtered,
  filters: { search, area, category },
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
  const { places, loading } = catalog;
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(6);
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
      <div className="p2-section-head">
        <div>
          <h3>Find destinations</h3>
          <p className="p2-muted">
            Search or filter, then add a stop to {day}.
          </p>
        </div>
        <a className="p2-back" href="/#palawan-map">
          Explore main map ↗
        </a>
      </div>
      <div
        className="p2-tabs p2-mobile-only"
        role="group"
        aria-label="Choose how to find a Place"
      >
        <button
          className="p2-button p2-button--quiet"
          onClick={() =>
            section.current
              ?.querySelector<HTMLInputElement>('input[type="search"]')
              ?.focus()
          }
        >
          Search by Name
        </button>
        <button className="p2-button p2-button--quiet" onClick={onExploreMap}>
          Explore map
        </button>
      </div>
      <fieldset
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
        <div className="p2-form__row">
          <label>
            Area
            <select
              aria-label="Area"
              value={area}
              onChange={(e) => {
                onFiltersChange({ area: e.target.value });
                setLimit(6);
              }}
            >
              <option value="">All areas</option>
              {[...new Set(places.flatMap((p) => p.area.split(" · ")))]
                .filter(Boolean)
                .sort()
                .map((a) => (
                  <option key={a}>{a}</option>
                ))}
            </select>
          </label>
          <label>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => {
                onFiltersChange({ category: e.target.value });
                setLimit(6);
              }}
            >
              <option value="">All categories</option>
              {[...new Set(places.flatMap((p) => p.category.split(" · ")))]
                .filter(Boolean)
                .sort()
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
        </div>
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
                  Try another name or clear the filters. Only destinations
                  available to your membership are shown.
                </p>
                <button
                  type="button"
                  className="p2-button p2-button--quiet"
                  onClick={() => {
                    onFiltersChange({ search: "", area: "", category: "" });
                    setLimit(6);
                  }}
                >
                  Clear filters
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
                      {p.image && <img src={p.image} alt="" loading="lazy" />}
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
    </section>
  );
}
