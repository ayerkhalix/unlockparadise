"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const key = "upd:last-browsing-page";
function browsingTarget(value: string, referrer = false) {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const target = new URL(value, location.origin);
    if (
      target.origin !== location.origin ||
      /^\/(?:explorer-plus|membership|login|join|checkout|auth)(?:\/|$)/.test(
        target.pathname,
      ) ||
      (referrer &&
        /^\/(?:place|bucketlist|portfolio|itineraries)(?:\/|$)/.test(
          target.pathname,
        ))
    )
      return null;
    const path = target.pathname + target.search + target.hash;
    return path === location.pathname + location.search + location.hash
      ? null
      : path;
  } catch {
    return null;
  }
}
export function BrowsingTrail() {
  const path = usePathname();
  const query = useSearchParams();
  useEffect(() => {
    if (document.querySelector(".member-lock")) return;
    if (
      /^\/(?:explorer-plus|membership|login|join|checkout)(?:\/|$)/.test(path)
    )
      return;
    const url = path + (query.size ? `?${query}` : "") + location.hash;
    try {
      sessionStorage.setItem(key, url);
    } catch {
      /* Back still has a safe fallback. */
    }
  }, [path, query]);
  return null;
}
export function GateBack() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="member-lock__return p2-back"
      onClick={() => {
        let previous = "";
        try {
          previous = sessionStorage.getItem(key) || "";
        } catch {
          /* Use map fallback. */
        }
        const target =
          browsingTarget(previous) || browsingTarget(document.referrer, true);
        router.push(target || "/#palawan-map");
      }}
    >
      Back
    </button>
  );
}
export function GateUpgrade() {
  const path = usePathname();
  const query = useSearchParams();
  return (
    <a
      className="upd-btn upd-btn--vip"
      href={`/membership/?return_to=${encodeURIComponent(path + (query.size ? `?${query}` : ""))}`}
    >
      Upgrade to Explorer+
    </a>
  );
}
