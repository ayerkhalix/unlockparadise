"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  libraryFilters,
  libraryHref,
  type ItineraryLibraryResult,
  type LibraryFilters,
} from "@/lib/itinerary-library";
import { plannerHref, tripDateLabel, type Trip } from "@/lib/planning";
import { requestJSON, notify } from "@/lib/client-api";
import { ContentImage } from "./ui/content-image";
import { SearchInput } from "./ui/search-input";
import { Modal } from "./ui/modal";
import { TripForm } from "./trip-form";

export function ItineraryLibrary() {
  const params = useSearchParams();
  const filters = libraryFilters(Object.fromEntries(params));
  const href = libraryHref(filters);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${href}:${attempt}`;
  const [received, setReceived] = useState<{
    key: string;
    result: ItineraryLibraryResult | null;
    error: string;
  }>({ key: "", result: null, error: "" });
  const previous = useRef<LibraryFilters | null>(null);
  const resultsHeading = useRef<HTMLParagraphElement>(null);
  const scrollToResults = useRef(false);
  const [creating, setCreating] = useState(false);
  const showCreate = creating || params.get("create") === "1";
  const pending = received.key !== requestKey;
  const error = !pending && received.error;
  const result = received.result;

  useEffect(() => {
    const controller = new AbortController();
    const current = libraryFilters(
      Object.fromEntries(new URLSearchParams(href.split("?")[1])),
    );
    const prior = previous.current;
    previous.current = current;
    const onlySearchChanged =
      prior &&
      prior.q !== current.q &&
      prior.area === current.area &&
      prior.sort === current.sort;
    const timer = setTimeout(
      async () => {
        try {
          const data = await requestJSON<ItineraryLibraryResult>(
            `/api/v1/itineraries/library/${href.includes("?") ? href.slice(href.indexOf("?")) : ""}`,
            "GET",
            undefined,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const actualHref = libraryHref({ ...current, page: data.page });
          if (actualHref !== href) history.replaceState(null, "", actualHref);
          setReceived({
            key: `${actualHref}:${attempt}`,
            result: data,
            error: "",
          });
          if (scrollToResults.current) {
            scrollToResults.current = false;
            resultsHeading.current?.focus({ preventScroll: true });
            resultsHeading.current?.scrollIntoView({
              block: "start",
              behavior: "instant",
            });
          }
        } catch (failure) {
          if (!controller.signal.aborted)
            setReceived((old) => ({
              ...old,
              key: requestKey,
              error: (failure as Error).message,
            }));
        }
      },
      onlySearchChanged && current.q ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [href, requestKey, attempt]);

  const change = (patch: Partial<LibraryFilters>, pagination = false) => {
    const next = {
      ...libraryFilters(
        Object.fromEntries(new URLSearchParams(location.search)),
      ),
      ...patch,
      page: pagination ? patch.page || 1 : 1,
    };
    scrollToResults.current = pagination;
    history.replaceState(null, "", libraryHref(next));
  };
  const clear = () => change({ q: "", area: "", sort: "recent" });
  const filtered = Boolean(filters.q || filters.area);
  const openCreated = (trip: Trip) => {
    closeCreate();
    notify("Itinerary created. Add your first destination.");
    router.push(plannerHref(trip.id, undefined, href));
  };
  const closeCreate = () => {
    setCreating(false);
    if (params.has("create")) history.replaceState(null, "", href);
  };
  return (
    <section
      className="itinerary-library"
      aria-labelledby="itinerary-library-title"
    >
      <header className="itinerary-library__header">
        <div>
          <h1 id="itinerary-library-title">My itineraries</h1>
          <p>Find your plans. Pick up where you left off.</p>
        </div>
        <button
          type="button"
          className="p2-button"
          onClick={() => setCreating(true)}
        >
          <span aria-hidden="true">+</span> Create itinerary
        </button>
      </header>
      <div
        className="p2-filters itinerary-library__filters"
        role="search"
        aria-label="Find an itinerary"
      >
        <label>
          Search itineraries
          <SearchInput
            label="Search itineraries"
            disabled={!result}
            placeholder="Find a trip by name"
            value={filters.q}
            onValueChange={(q) => change({ q })}
          />
        </label>
        <label>
          Area
          <select
            aria-label="Area"
            value={filters.area}
            disabled={!result}
            onChange={(e) => change({ area: e.target.value })}
          >
            <option value="">All areas</option>
            {result?.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
            <option value="unassigned">Area not selected</option>
            {filters.area &&
              filters.area !== "unassigned" &&
              !result?.areas.some((area) => area.id === filters.area) && (
                <option value={filters.area}>Selected area</option>
              )}
          </select>
        </label>
        <label>
          Sort by
          <select
            aria-label="Sort by"
            value={filters.sort}
            onChange={(e) =>
              change({ sort: e.target.value as LibraryFilters["sort"] })
            }
          >
            <option value="recent">Recently edited</option>
            <option value="date">Trip date</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <div className="itinerary-library__results-head">
        <p ref={resultsHeading} role="status" aria-atomic="true" tabIndex={-1}>
          {pending
            ? result
              ? "Updating your itineraries…"
              : "Loading your itineraries…"
            : error
              ? "Your itineraries could not be loaded."
              : result?.count
                ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.count)} of ${result.count} ${result.count === 1 ? "itinerary" : "itineraries"}`
                : "No itineraries to show"}
        </p>
        {(filtered || filters.sort !== "recent") && (
          <button type="button" className="p2-back" onClick={clear}>
            Clear filters
          </button>
        )}
      </div>
      {error && (
        <div className="itinerary-library__error p2-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="p2-button p2-button--quiet"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <div className="itinerary-library__results" aria-busy={pending}>
        {!result && pending ? (
          <div className="itinerary-library__loading" aria-hidden="true" />
        ) : (
          !error &&
          result && (
            <>
              {result.data.length ? (
                <ul className="itinerary-library__grid" inert={pending}>
                  {result.data.map((trip, index) => (
                    <li key={trip.id} className="itinerary-library-card">
                      <a
                        className="itinerary-library-card__link"
                        data-itinerary-card
                        href={plannerHref(trip.id, undefined, href)}
                      >
                        <div className="itinerary-library-card__photo">
                          {trip.image ? (
                            <ContentImage
                              src={trip.image}
                              alt=""
                              sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 46vw, 30vw"
                              loading={index < 3 ? "eager" : "lazy"}
                            />
                          ) : (
                            <span>No destinations yet</span>
                          )}
                        </div>
                        <div className="itinerary-library-card__body">
                          <p className="itinerary-library-card__area">
                            {trip.area}
                          </p>
                          <h2>{trip.title}</h2>
                          <p className="itinerary-library-card__dates">
                            {tripDateLabel(trip.start_date, trip.end_date)}
                          </p>
                          <p className="itinerary-library-card__counts">
                            {trip.day_count}{" "}
                            {trip.day_count === 1 ? "day" : "days"}
                            <span aria-hidden="true"> · </span>
                            {trip.stop_count}{" "}
                            {trip.stop_count === 1
                              ? "destination"
                              : "destinations"}
                          </p>
                          <span className="itinerary-library-card__open">
                            Open itinerary <span aria-hidden="true">↗</span>
                          </span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                !pending && (
                  <div className="itinerary-library__empty">
                    <h2>
                      {result.total === 0
                        ? "Your first Palawan itinerary starts here"
                        : "No itineraries match your filters"}
                    </h2>
                    <p>
                      {result.total === 0
                        ? "Choose an area, add the places you want to see and make the trip your own."
                        : "Try another name or area to find your saved plans."}
                    </p>
                    <button
                      type="button"
                      className="p2-button"
                      onClick={
                        result.total === 0 ? () => setCreating(true) : clear
                      }
                    >
                      {result.total === 0
                        ? "Create itinerary"
                        : "Clear filters"}
                    </button>
                  </div>
                )
              )}
              {result.pages > 1 && (
                <nav
                  className="itinerary-library__pagination"
                  aria-label="Itinerary pages"
                >
                  <button
                    type="button"
                    className="p2-button p2-button--quiet"
                    disabled={pending || result.page === 1}
                    onClick={() => change({ page: result.page - 1 }, true)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {result.page} of {result.pages}
                  </span>
                  <button
                    type="button"
                    className="p2-button p2-button--quiet"
                    disabled={pending || result.page === result.pages}
                    onClick={() => change({ page: result.page + 1 }, true)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )
        )}
      </div>
      {showCreate && (
        <Modal title="Create itinerary" onClose={closeCreate}>
          <TripForm
            initialAreaId={filters.area === "unassigned" ? "" : filters.area}
            createLabel="Create itinerary"
            onSaved={openCreated}
            onCancel={closeCreate}
          />
        </Modal>
      )}
    </section>
  );
}
