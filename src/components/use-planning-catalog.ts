"use client";
import { useCallback, useEffect, useState } from "react";
import { requestJSON } from "@/lib/client-api";
import type { TravelPlace } from "@/lib/planning";
import type { MapConfiguration } from "./palawan-map";
import { useBrowseSession } from "./browse-session";

export type PlanningCatalog = {
  places: TravelPlace[];
  metadata?: Pick<MapConfiguration, "areas" | "categories">;
  loading: boolean;
  error: string;
  reload: () => void;
};
export function usePlanningCatalog(
  tripId?: string,
  areaId?: string | null,
): PlanningCatalog {
  const key = `${tripId || ""}:${areaId || ""}`;
  const session = useBrowseSession();
  const cacheKey = `planning:${key}`;
  const [state, setState] = useState<
    Omit<PlanningCatalog, "reload"> & { key: string }
  >(
    () =>
      session?.read<Omit<PlanningCatalog, "reload"> & { key: string }>(
        cacheKey,
      ) || {
        key,
        places: [],
        loading: true,
        error: "",
      },
  );
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (tripId && !areaId) return;
    requestJSON<{ data: TravelPlace[]; map?: PlanningCatalog["metadata"] }>(
      `/api/v1/planning-places/${tripId ? `?trip=${encodeURIComponent(tripId)}` : ""}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          const next = {
            key,
            places: result.data,
            metadata: result.map,
            loading: false,
            error: "",
          };
          session?.write(cacheKey, next);
          setState(next);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          session?.remove(cacheKey);
          setState({
            key,
            places: [],
            loading: false,
            error: error.message,
          });
        }
      });
    return () => controller.abort();
  }, [revision, tripId, areaId, key, session, cacheKey]);
  if (tripId && !areaId)
    return {
      places: [],
      loading: false,
      error: "Choose a trip area in Edit trip before adding destinations.",
      reload,
    };
  return state.key === key
    ? { ...state, reload }
    : { places: [], loading: true, error: "", reload };
}
