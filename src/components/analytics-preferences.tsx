"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
        "Your browser cannot save this preference. Optional analytics stays off.",
      );
    }
    window.dispatchEvent(new Event("upd:analytics-consent"));
    setOpen(false);
  }
  if (path.startsWith("/admin")) return null;
  return (
    <>
      {value === "unanswered" && (
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
            Essential cookies keep your sign-in working. Browser storage also
            remembers your cart and privacy choices. These features do not
            require optional analytics.
          </p>
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
            Do Not Track and Global Privacy Control keep analytics off even if
            you previously allowed it.
          </p>
          <p>
            <a href="/privacy-policy/">Read our Privacy Policy</a>
          </p>
          <p>
            Current analytics preference:{" "}
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
function CookieNotice({
  onChoose,
  onManage,
}: {
  onChoose: (allowed: boolean) => void;
  onManage: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const measure = () =>
      root.style.setProperty(
        "--p2-consent-clearance",
        `${Math.ceil(ref.current?.getBoundingClientRect().height || 0) + 12}px`,
      );
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    measure();
    return () => {
      observer.disconnect();
      root.style.removeProperty("--p2-consent-clearance");
    };
  }, []);
  return createPortal(
    <section
      ref={ref}
      className="p2-cookie-banner"
      aria-labelledby="cookie-notice-title"
    >
      <div className="p2-cookie-banner__copy">
        <h2 id="cookie-notice-title">Cookies &amp; privacy</h2>
        <p>
          We use essential cookies for sign-in and browser storage for your
          cart. Optional analytics helps us improve the site and stays off until
          you allow it. <a href="/privacy-policy/">Privacy Policy</a>
        </p>
      </div>
      <div className="p2-cookie-banner__choices">
        <button
          type="button"
          className="p2-button p2-button--quiet"
          onClick={() => onChoose(false)}
        >
          Essential only
        </button>
        <button
          type="button"
          className="p2-button p2-button--quiet"
          onClick={() => onChoose(true)}
        >
          Allow analytics
        </button>
        <button type="button" className="p2-cookie-manage" onClick={onManage}>
          Manage preferences
        </button>
      </div>
    </section>,
    document.body,
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
