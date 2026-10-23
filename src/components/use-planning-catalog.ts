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
export function usePlanningCatalog(): PlanningCatalog {
  const [state, setState] = useState<Omit<PlanningCatalog, "reload">>({
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
    requestJSON<{ data: TravelPlace[]; map?: PlanningCatalog["metadata"] }>(
      "/api/v1/planning-places/",
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted)
          setState({
            places: result.data,
            metadata: result.map,
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message,
          }));
      });
    return () => controller.abort();
  }, [revision]);
  return { ...state, reload };
}
