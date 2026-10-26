"use client";
import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ItineraryPlanner } from "./itinerary-planner";
import { useDecision } from "./ui/decision";
import { safeLibraryReturn } from "@/lib/itinerary-library";
import type { Trip } from "@/lib/planning";

export function ItineraryWorkspace({ selected }: { selected: Trip }) {
  const router = useRouter();
  const params = useSearchParams();
  const target = safeLibraryReturn(params.get("return_to")) || "/itineraries/";
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const reportDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);
  const reportSaving = useCallback((value: boolean) => {
    savingRef.current = value;
    setSaving(value);
  }, []);
  const [pending, startTransition] = useTransition();
  const { ask, dialog } = useDecision();
  const rememberReturn = () => {
    try {
      sessionStorage.setItem("upd:restore-browse", target);
    } catch {
      /* The library URL still preserves filters without storage. */
    }
  };
  return (
    <div className="p2-workspace">
      {dialog}
      <div className="p2-workspace-toolbar p2-workspace-toolbar--trip">
        <a
          className="p2-back"
          href={target}
          aria-disabled={pending || saving || undefined}
          onClick={async (event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            if (pending || savingRef.current) return;
            if (
              dirtyRef.current &&
              !(await ask(
                "Discard unsaved stop notes or visit times before leaving this trip?",
              ))
            )
              return;
            rememberReturn();
            startTransition(() => router.push(target));
          }}
        >
          <span aria-hidden="true">‹</span> My itineraries
        </a>
        <span className="p2-workspace-label">Itinerary Planner</span>
      </div>
      <p className="p2-workspace-status p2-muted" role="status">
        {pending
          ? "Opening your itineraries…"
          : saving
            ? "Saving your plan…"
            : dirty
              ? "You have unsaved stop notes or visit times."
              : ""}
      </p>
      <div inert={pending} aria-busy={pending}>
        <ItineraryPlanner
          initial={selected}
          onDirtyChange={reportDirty}
          onBusyChange={reportSaving}
          onDeleted={() => {
            rememberReturn();
            startTransition(() => router.replace(target));
          }}
        />
      </div>
    </div>
  );
}
