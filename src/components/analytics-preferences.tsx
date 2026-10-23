"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "./ui/modal";
import { captureInterest } from "@/lib/analytics-client";
const key = "upd-analytics-consent";
function snapshot() {
  try {
    return localStorage.getItem(key) || "off";
  } catch {
    return "off";
  }
}
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener("upd:analytics-consent", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("upd:analytics-consent", fn);
  };
}
export function AnalyticsPreferences() {
  const path = usePathname(),
    value = useSyncExternalStore(subscribe, snapshot, () => "off"),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  function choose(allowed: boolean) {
    try {
      localStorage.setItem(key, allowed ? "allowed" : "off");
      if (!allowed) sessionStorage.removeItem("upd-analytics-session");
      window.dispatchEvent(new Event("upd:analytics-consent"));
      setOpen(false);
    } catch {
      setError(
        "Your browser cannot save this preference. Optional analytics stays off.",
      );
    }
  }
  if (path.startsWith("/admin")) return null;
  return (
    <>
      <div className="p2-privacy-preferences">
        <button type="button" className="p2-back" onClick={() => setOpen(true)}>
          Privacy preferences
        </button>
      </div>
      {open && (
        <Modal title="Optional analytics" onClose={() => setOpen(false)}>
          <p>
            Help us understand which Places and products people explore.
            Analytics is off unless you allow it.
          </p>
          <p>
            We collect event names, Place/product references and a random
            session identifier. We do not send account identities, notes,
            passwords, payment details or precise movements. Daily cleanup
            removes events older than 90 days. Browser privacy signals and
            automated tests disable tracking.
          </p>
          <p>
            Current preference:{" "}
            {value === "allowed"
              ? "Allowed (subject to browser privacy settings)"
              : "Off"}
            . You can change it here at any time.
          </p>
          <div className="p2-actions">
            <button
              data-initial-focus
              className="p2-button p2-button--quiet"
              onClick={() => choose(false)}
            >
              Keep analytics off
            </button>
            <button className="p2-button" onClick={() => choose(true)}>
              Allow analytics
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}
export function InterestView({
  placeId,
  productId,
}: {
  placeId?: string;
  productId?: number;
}) {
  const consent = useSyncExternalStore(subscribe, snapshot, () => "off");
  useEffect(() => {
    if (consent === "allowed") {
      if (placeId) captureInterest("place_viewed", { place_id: placeId });
      else if (productId)
        captureInterest("product_viewed", { product_id: productId });
    }
  }, [placeId, productId, consent]);
  return null;
}
