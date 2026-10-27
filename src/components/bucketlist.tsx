"use client";
import { SearchInput } from "./ui/search-input";
import { useCallback, useEffect, useState } from "react";
import { requestJSON } from "@/lib/client-api";
import type { TravelPlace } from "@/lib/planning";
import { ContentImage } from "./ui/content-image";
import { DestinationSkeleton } from "./ui/destination-skeleton";
import { useBrowseSession } from "./browse-session";
export type SavedRecord = {
  place_id: string;
  saved_at: string | null;
  visited_at: string | null;
  place: TravelPlace | null;
};
export function useSavedPlaces(enabled: boolean, kind = "bucketlist") {
  const session = useBrowseSession();
  const cacheKey = `saved:${kind}`;
  const cached = enabled ? session?.read<SavedRecord[]>(cacheKey) : undefined;
  const [rows, setRows] = useState<SavedRecord[]>(cached || []),
    [loading, setLoading] = useState(enabled && !cached),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const r = await requestJSON<{ data: SavedRecord[] }>(`/api/v1/${kind}/`);
      session?.write(cacheKey, r.data);
      setRows(r.data);
      setError("");
    } catch (e) {
      session?.remove(cacheKey);
      setRows([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [enabled, kind, session, cacheKey]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const refresh = () => {
      void load();
    };
    window.addEventListener("upd:member-places", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("upd:member-places", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  return { rows, loading, error, reload: load };
}
export function SavedPlaces({
  rows,
  compact = false,
  kind = "bucketlist",
}: {
  rows: SavedRecord[];
  compact?: boolean;
  kind?: "bucketlist" | "portfolio";
}) {
  return (
    <div className={compact ? "p2-saved-list" : "p2-place-grid"}>
      {rows.map((row) => (
        <article className="p2-saved-card" key={row.place_id}>
          {row.place?.image ? (
            <a
              href={`/place/${row.place.slug}/`}
              tabIndex={-1}
              aria-hidden="true"
            >
              <ContentImage src={row.place.image} alt="" loading="lazy" />
            </a>
          ) : (
            <div className="p2-image-placeholder" aria-hidden="true">
              ◇
            </div>
          )}
          <div className="p2-saved-card__body">
            <span className="p2-eyebrow">
              {row.place?.area || "Saved Place"}
            </span>
            <h3>
              {row.place ? (
                <a href={`/place/${row.place.slug}/`}>{row.place.title}</a>
              ) : (
                "Place unavailable"
              )}
            </h3>
            <p className="p2-muted">
              {row.place?.category ||
                "This Place may be unpublished or outside your membership."}
            </p>
            <div className="p2-actions">
              {row.place && (
                <button
                  type="button"
                  className="p2-button p2-button--quiet"
                  data-add-itinerary={row.place_id}
                >
                  Add to Itinerary
                </button>
              )}
              <button
                type="button"
                className="p2-icon"
                data-member-op={kind === "portfolio" ? "unvisit" : "unsave"}
                data-place-uuid={row.place_id}
                aria-pressed="true"
                aria-label={
                  kind === "portfolio"
                    ? "Remove from Portfolio"
                    : "Remove from Bucketlist"
                }
                data-tooltip={
                  kind === "portfolio"
                    ? "Remove from Portfolio"
                    : "Remove from Bucketlist"
                }
              >
                ×
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
export function SavedPlacesPage({
  kind = "bucketlist",
}: {
  kind?: "bucketlist" | "portfolio";
}) {
  const portfolio = kind === "portfolio";
  const searchLabel = portfolio
    ? "Search visited Places"
    : "Search saved Places";
  const { rows, loading, error, reload } = useSavedPlaces(true, kind);
  const [search, setSearch] = useState(""),
    [area, setArea] = useState(""),
    [category, setCategory] = useState("");
  const filtered = rows.filter(
    (r) =>
      (r.place?.title || "Place unavailable")
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!area || r.place?.area === area) &&
      (!category || r.place?.category === category),
  );
  return (
    <>
      <div className="p2-section-head p2-saved-heading">
        <div>
          <span className="p2-eyebrow">Discover · save · plan</span>
          <h1>{portfolio ? "My Portfolio" : "My Bucketlist"}</h1>
          <p className="p2-muted">
            {portfolio
              ? "The Places you’ve visited, all in one place."
              : "A little inspiration for your next escape. Turn saved Places into a trip."}
          </p>
        </div>
        <a href="/itineraries/" className="p2-button">
          Itinerary Planner ↗
        </a>
      </div>
      <nav className="p2-tabs" aria-label="Your places">
        <a href="/bucketlist/" aria-current={!portfolio ? "page" : undefined}>
          Bucketlist
        </a>
        <a href="/portfolio/" aria-current={portfolio ? "page" : undefined}>
          Portfolio
        </a>
      </nav>
      {rows.length > 0 && (
        <div className="p2-filters">
          <label>
            {searchLabel}
            <SearchInput
              label={searchLabel}
              value={search}
              onValueChange={setSearch}
              placeholder="Find a destination"
            />
          </label>
          <label>
            Area
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {[...new Set(rows.map((r) => r.place?.area).filter(Boolean))].map(
                (a) => (
                  <option key={a}>{a}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[
                ...new Set(rows.map((r) => r.place?.category).filter(Boolean)),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {loading ? (
        <DestinationSkeleton count={3} />
      ) : error ? (
        <div className="p2-error" role="alert">
          <p>{error}</p>
          <button className="p2-button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : filtered.length ? (
        <>
          <p className="p2-muted" role="status">
            {filtered.length} {filtered.length === 1 ? "Place" : "Places"}
          </p>
          <SavedPlaces rows={filtered} kind={kind} />
        </>
      ) : (
        <div className="p2-empty">
          <h2>
            {rows.length
              ? "No matching Places"
              : portfolio
                ? "Your portfolio is empty"
                : "Your next adventure starts here"}
          </h2>
          <p>
            {rows.length
              ? "Try a different name, area or category."
              : portfolio
                ? "Use Add to Portfolio on a destination you’ve visited to keep it here."
                : "Save a destination while exploring Palawan, then add it to an itinerary."}
          </p>
          {rows.length ? (
            <button
              className="p2-button"
              onClick={() => {
                setSearch("");
                setArea("");
                setCategory("");
              }}
            >
              Clear filters
            </button>
          ) : (
            <a href="/" className="p2-button">
              Discover Palawan
            </a>
          )}
        </div>
      )}
    </>
  );
}
