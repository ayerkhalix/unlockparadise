"use client";
import { useCallback, useEffect, useState } from "react";
import { requestJSON } from "@/lib/client-api";
import type { TravelPlace } from "@/lib/planning";
import type { MapConfiguration } from "./palawan-map";

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
  const [state, setState] = useState<
    Omit<PlanningCatalog, "reload"> & { key: string }
  >({
    key,
    places: [],
    loading: true,
    error: "",
  });
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
        if (!controller.signal.aborted)
          setState({
            key,
            places: result.data,
            metadata: result.map,
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            places: [],
            loading: false,
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [revision, tripId, areaId, key]);
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
