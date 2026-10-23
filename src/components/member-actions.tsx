"use client";
import { useEffect } from "react";
import { captureInterest } from "@/lib/analytics-client";
import { useRouter } from "next/navigation";
import { notify, requestJSON } from "@/lib/client-api";
import { travelFlight, cancelFlights } from "@/lib/travel-motion";
export function MemberActions() {
  const router = useRouter();
  useEffect(() => {
    const pending = new Set<string>();
    const click = async (event: MouseEvent) => {
      const target = event.target as Element;
      const feature = target.closest<HTMLButtonElement>(
        "[data-profile-feature]",
      );
      if (feature && !feature.disabled) {
        feature.disabled = true;
        try {
          await requestJSON("/api/v1/me/", "PATCH", {
            featured_place_id: feature.dataset.profileFeature || null,
          });
          notify("Account featured place updated.");
          router.refresh();
        } catch (e) {
          notify((e as Error).message, true);
        } finally {
          feature.disabled = false;
        }
        return;
      }
      const button = target.closest<HTMLButtonElement>("[data-member-op]");
      if (!button || button.disabled) return;
      const pid = button.dataset.placeUuid;
      if (!pid || pending.has(pid)) return;
      pending.add(pid);
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          `[data-member-op][data-place-uuid="${pid}"]`,
        ),
      );
      buttons.forEach((b) => {
        b.disabled = true;
        b.setAttribute("aria-busy", "true");
      });
      const op = button.dataset.memberOp;
      try {
        const result = await requestJSON<{
          data: { saved: boolean; visited: boolean };
        }>("/api/v1/bucketlist/", "POST", { place_id: pid, op });
        buttons.forEach((b) => {
          const save = ["save", "unsave"].includes(b.dataset.memberOp || "");
          const on = save ? result.data.saved : result.data.visited;
          const label = save
            ? on
              ? "Remove from Bucketlist"
              : "Add to Bucketlist"
            : on
              ? "Remove from Portfolio"
              : "Add to Portfolio";
          b.dataset.memberOp = save
            ? on
              ? "unsave"
              : "save"
            : on
              ? "unvisit"
              : "visit";
          b.setAttribute("aria-pressed", String(on));
          b.setAttribute("aria-label", label);
          b.dataset.tooltip = label;
          b.classList.toggle(save ? "is-saved" : "is-visited", on);
        });
        if (op === "save" && result.data.saved)
          travelFlight({ kind: "bucketlist", control: button, key: pid });
        if (op === "unsave") cancelFlights(pid);
        notify(
          op === "save"
            ? "Added to your Bucketlist."
            : op === "unsave"
              ? "Removed from your Bucketlist."
              : op === "visit"
                ? "Added to your Portfolio."
                : "Removed from your Portfolio.",
        );
        window.dispatchEvent(new Event("upd:member-places"));
        if (op === "save" || op === "unsave")
          captureInterest(
            op === "save" ? "place_saved" : "place_removed_from_bucketlist",
            { place_id: pid },
          );
        router.refresh();
      } catch (e) {
        notify((e as Error).message, true);
      } finally {
        pending.delete(pid);
        buttons.forEach((b) => {
          b.disabled = false;
          b.removeAttribute("aria-busy");
        });
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [router]);
  return null;
}
