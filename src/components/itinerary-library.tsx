"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  libraryFilters,
  libraryHref,
  type ItineraryLibraryResult,
} from "@/lib/itinerary-library";
import { plannerHref, type Trip } from "@/lib/planning";
import { requestJSON, notify } from "@/lib/client-api";
import { ItineraryLibraryCard } from "./itinerary-library-card";
import { Modal } from "./ui/modal";
import { TripForm } from "./trip-form";
import { useBrowseSession } from "./browse-session";

export function ItineraryLibrary() {
  const params = useSearchParams();
  const filters = libraryFilters({ page: params.get("page") || 1 });
  const href = libraryHref(filters);
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${href}:${attempt}`;
  const session = useBrowseSession();
  const cacheKey = `library:${href}`;
  const [received, setReceived] = useState<{
    key: string;
    result: ItineraryLibraryResult | null;
    error: string;
  }>(() => ({
    key: session?.read(cacheKey) ? requestKey : "",
    result: session?.read<ItineraryLibraryResult>(cacheKey) || null,
    error: "",
  }));
  const resultsHeading = useRef<HTMLParagraphElement>(null);
  const scrollToResults = useRef(false);
  const [creating, setCreating] = useState(false);
  const showCreate = creating || params.get("create") === "1";
  const pending = received.key !== requestKey;
  const error = !pending && received.error;
  const result = received.result;
  const empty = !pending && !error && result?.total === 0;

  useEffect(() => {
    const controller = new AbortController();
    const current = libraryFilters(
      Object.fromEntries(new URLSearchParams(href.split("?")[1])),
    );
    void (async () => {
      try {
        const data = await requestJSON<ItineraryLibraryResult>(
          `/api/v1/itineraries/library/${href.includes("?") ? href.slice(href.indexOf("?")) : ""}`,
          "GET",
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const actualHref = libraryHref({ ...current, page: data.page });
        session?.write(`library:${actualHref}`, data);
        const canonical = new URL(actualHref, location.origin);
        if (new URLSearchParams(location.search).get("create") === "1")
          canonical.searchParams.set("create", "1");
        const canonicalHref = canonical.pathname + canonical.search;
        if (location.pathname + location.search !== canonicalHref)
          history.replaceState(null, "", canonicalHref);
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
        if (!controller.signal.aborted) session?.remove(cacheKey);
        if (!controller.signal.aborted)
          setReceived((old) => ({
            ...old,
            key: requestKey,
            error: (failure as Error).message,
          }));
      }
    })();
    return () => {
      controller.abort();
    };
  }, [href, requestKey, attempt, session, cacheKey]);

  const changePage = (page: number) => {
    scrollToResults.current = true;
    // Next copies its router state and syncs useSearchParams for this URL change.
    history.replaceState(null, "", libraryHref(libraryFilters({ page })));
  };
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
          <p>Organize your trips here</p>
        </div>
        {!!result?.total && (
          <button
            type="button"
            className="p2-button"
            onClick={() => setCreating(true)}
          >
            <span aria-hidden="true">+</span> Add itinerary
          </button>
        )}
      </header>
      <div className={empty ? "p2-sr-only" : "itinerary-library__results-head"}>
        <p ref={resultsHeading} role="status" aria-atomic="true" tabIndex={-1}>
          {pending
            ? result
              ? "Updating your itineraries…"
              : "Loading your itineraries…"
            : error
              ? "Your itineraries could not be loaded."
              : result?.count
                ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.count)} of ${result.count} ${result.count === 1 ? "itinerary" : "itineraries"}`
                : "No itineraries yet"}
        </p>
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
                    <ItineraryLibraryCard
                      key={trip.id}
                      trip={trip}
                      href={plannerHref(trip.id, undefined, href)}
                      eager={index < 3}
                    />
                  ))}
                </ul>
              ) : (
                !pending && (
                  <div className="itinerary-library__empty">
                    <div
                      className="itinerary-library__empty-icon"
                      aria-hidden="true"
                    >
                      <svg
                        width="84"
                        height="84"
                        viewBox="0 0 96 96"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 37 23-9 23 9 20-7v47l-20 8-23-9-23 9V37Z M38 28v48m23-30v39" />
                        <path
                          d="M31 64c-3-12 7-19 15-11s17 9 21-6"
                          strokeDasharray="3 6"
                        />
                        <path
                          d="M67 12c-7 0-12 5-12 12 0 9 12 22 12 22s12-13 12-22c0-7-5-12-12-12Z"
                          fill="var(--p2-text)"
                          stroke="var(--p2-text)"
                        />
                        <circle
                          cx="67"
                          cy="24"
                          r="4"
                          fill="var(--p2-panel)"
                          stroke="var(--p2-panel)"
                        />
                        <path d="m34 10 5 6m8-11v9" />
                      </svg>
                    </div>
                    <h2>No itineraries yet</h2>
                    <p>
                      Plan and save your trips here so you can easily access
                      them anytime.
                    </p>
                    <button
                      type="button"
                      className="p2-button p2-button--quiet itinerary-library__add"
                      onClick={() => setCreating(true)}
                    >
                      <span aria-hidden="true">+</span> Add itinerary
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
                    onClick={() => changePage(result.page - 1)}
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
                    onClick={() => changePage(result.page + 1)}
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
            createLabel="Create itinerary"
            onSaved={openCreated}
            onCancel={closeCreate}
          />
        </Modal>
      )}
    </section>
  );
}
