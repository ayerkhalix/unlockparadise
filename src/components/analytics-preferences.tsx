"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "./ui/modal";
import { captureInterest } from "@/lib/analytics-client";
import {
  readConsentChoice as snapshot,
  saveConsentChoice,
} from "@/lib/privacy-consent";
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
    value = useSyncExternalStore(subscribe, snapshot, () => "pending"),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  function choose(allowed: boolean) {
    if (saveConsentChoice(allowed)) {
      setError("");
    } else {
      setError(
        "Your browser cannot save this preference. Optional cookies will stay off.",
      );
    }
    window.dispatchEvent(new Event("upd:analytics-consent"));
    setOpen(false);
  }
  if (path.startsWith("/admin")) return null;
  return (
    <>
      {value === "unanswered" && !open && (
        <CookieNotice onChoose={choose} onManage={() => setOpen(true)} />
      )}
      <div className="p2-privacy-preferences">
        <button type="button" className="p2-back" onClick={() => setOpen(true)}>
          Privacy preferences
        </button>
      </div>
      {error && (
        <p className="p2-cookie-storage-error" role="status">
          {error}
        </p>
      )}
      {open && (
        <Modal title="Cookies & privacy" onClose={() => setOpen(false)}>
          <p>
            Some cookies keep you signed in and remember your cart and privacy
            choices. These always work, whichever option you choose.
          </p>
          <p>
            Help us understand which Places and products people explore.
            Optional cookies help us do this. They stay off unless you accept them.
          </p>
          <p>
            We collect event names, Place/product references and a random
            session identifier. We do not send account identities, notes,
            passwords, payment details or precise movements. Daily cleanup
            removes events older than 90 days. Browser privacy signals and
            automated tests disable tracking.
          </p>
          <p>
            Do Not Track and Global Privacy Control keep optional cookies off even if
            you previously allowed it.
          </p>
          <p>
            <a href="/privacy-policy/">Read our Privacy Policy</a>
          </p>
          <p>
            Optional cookies:{" "}
            {value === "allowed"
              ? "Accepted (subject to browser privacy settings)"
              : "Off"}
            . You can change it here at any time.
          </p>
          <div className="p2-actions">
            <button
              data-initial-focus
              className="p2-button p2-button--quiet"
              onClick={() => choose(false)}
            >
              No thanks
            </button>
            <button className="p2-button" onClick={() => choose(true)}>
              Accept cookies
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}
function CookieNotice({
  onChoose,
  onManage,
}: {
  onChoose: (allowed: boolean) => void;
  onManage: () => void;
}) {
  return (
    <Modal title="Cookies & privacy" onClose={() => onChoose(false)}>
      <div className="cookie-dialog">
        <p>
          We use cookies to keep you signed in and remember your cart. With your
          permission, we also use cookies to understand how the site is used and
          make it better.
        </p>
        <a href="/privacy-policy/">Read our Privacy Policy</a>
        <div className="p2-actions">
          <button
            type="button"
            data-initial-focus
            className="p2-button p2-button--quiet"
            onClick={() => onChoose(false)}
          >
            No thanks
          </button>
          <button
            type="button"
            className="p2-button p2-button--quiet"
            onClick={() => onChoose(true)}
          >
            Accept cookies
          </button>
        </div>
        <button type="button" className="p2-back" onClick={onManage}>
          Manage preferences
        </button>
      </div>
    </Modal>
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
