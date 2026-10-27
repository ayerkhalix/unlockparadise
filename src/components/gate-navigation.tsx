"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { safeBrowseReturn } from "@/lib/browsing-return";
import { upgradeHref } from "@/lib/membership-navigation";
import type { Tier } from "@/lib/destinations";
import { useBrowseSession } from "./browse-session";
import { finishBrowseRestore, holdBrowseRestore } from "@/lib/browse-restore";

const key = "upd:last-browsing-page";
type BrowsePosition = {
  url: string;
  y: number;
  href: string;
  top: number;
  anchor: string;
  height: number;
  scope: string;
};
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
  const router = useRouter();
  const session = useBrowseSession();
  const departure = useRef<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (document.querySelector(".member-lock")) return;
    if (
      /^\/(?:place|explorer-plus|membership|login|join|checkout)(?:\/|$)/.test(
        path,
      )
    )
      return;
    const url = location.pathname + location.search + location.hash;
    try {
      sessionStorage.setItem(key, url);
    } catch {
      /* Back still has a safe fallback. */
    }
  }, [path, query]);
  useEffect(() => {
    const source = () => location.pathname + location.search + location.hash;
    const storageKey = (url: string) => `upd:browse-position:${url}`;
    const remember = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (link.target !== "" && link.target !== "_self") ||
        link.hasAttribute("download")
      )
        return;
      const url = new URL(link.href, location.origin);
      const current = safeBrowseReturn(source());
      const itineraryCard =
        link.hasAttribute("data-itinerary-card") &&
        url.pathname === "/itineraries/" &&
        url.searchParams.has("trip");
      if (
        url.origin !== location.origin ||
        (!url.pathname.startsWith("/place/") && !itineraryCard) ||
        !current
      )
        return;
      const saved: BrowsePosition = {
        url: current,
        scope: session?.scope || "",
        height: document.documentElement.scrollHeight,
        y: window.scrollY,
        href: itineraryCard ? url.pathname + url.search : url.pathname,
        top: link.getBoundingClientRect().top,
        anchor: itineraryCard
          ? "itinerary"
          : link.classList.contains("upd-card__link")
            ? "card"
            : link.closest("[data-upd-strip]")
              ? "photo"
              : link.closest("h1,h2,h3")
                ? "heading"
                : "other",
      };
      try {
        // Preserve Next's history fields and bind the snapshot to this exact visit.
        history.replaceState(
          { ...history.state, updBrowsePosition: saved },
          "",
        );
      } catch {
        /* Session storage remains an independent fallback. */
      }
      try {
        sessionStorage.setItem(storageKey(current), JSON.stringify(saved));
        sessionStorage.setItem("upd:restore-browse", current);
        sessionStorage.setItem("upd:last-browsing-page", current);
      } catch {
        /* Link retains a safe return even without storage. */
      }
      url.searchParams.set("return_to", current);
      link.href = url.pathname + url.search + url.hash;
      departure.current = {
        from: current,
        to: url.pathname + url.search + url.hash,
      };
      event.preventDefault();
      router.push(departure.current.to);
    };
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, [router, session]);
  useLayoutEffect(() => {
    const url = location.pathname + location.search + location.hash;
    if (departure.current?.to === url) {
      try {
        history.replaceState(
          { ...history.state, updBrowseOrigin: departure.current.from },
          "",
        );
      } catch {
        /* The validated Return URL still works without history metadata. */
      }
      departure.current = null;
    }
    if (!safeBrowseReturn(url)) {
      finishBrowseRestore();
      return;
    }
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    let returning = navigation?.type === "back_forward";
    try {
      const referrer = new URL(document.referrer);
      returning ||=
        referrer.origin === location.origin &&
        referrer.pathname.startsWith("/place/");
    } catch {
      /* Direct entry has no referrer. */
    }
    try {
      returning ||= sessionStorage.getItem("upd:restore-browse") === url;
    } catch {
      /* Native history remains available. */
    }
    let timer: ReturnType<typeof setTimeout> | undefined,
      cancelled = false;
    const cancel = () => {
      cancelled = true;
      finishBrowseRestore();
    };
    const restore = () => {
      if (location.pathname + location.search + location.hash !== url) return;
      clearTimeout(timer);
      // A cached page keeps its old effect and cancellation state alive.
      cancelled = false;
      let saved: BrowsePosition | null = history.state?.updBrowsePosition;
      if (saved?.url !== url) saved = null;
      try {
        saved ||= JSON.parse(
          sessionStorage.getItem(`upd:browse-position:${url}`) || "null",
        );
      } catch {
        /* History can restore even when browser storage is unavailable. */
      }
      if (!saved || !Number.isFinite(saved.y) || !Number.isFinite(saved.top)) {
        finishBrowseRestore();
        return;
      }
      if (saved.scope && saved.scope !== session?.scope) {
        finishBrowseRestore();
        return;
      }
      const started = performance.now();
      const attempt = () => {
        if (cancelled || performance.now() - started > 8000) {
          finishBrowseRestore();
          return;
        }
        if (document.querySelector("main [role=alert]")) {
          finishBrowseRestore();
          return;
        }
        const selector =
          saved!.anchor === "itinerary"
            ? "main a[data-itinerary-card]"
            : saved!.anchor === "card"
              ? "main a.upd-card__link[href]"
              : saved!.anchor === "photo"
                ? "main [data-upd-strip] a[href]"
                : saved!.anchor === "heading"
                  ? "main h1 a[href],main h2 a[href],main h3 a[href]"
                  : "main a[href]";
        const link = Array.from(
          document.querySelectorAll<HTMLAnchorElement>(selector),
        ).find((a) => {
          const target = new URL(a.href, location.origin);
          return (
            (saved!.anchor === "itinerary"
              ? target.pathname + target.search
              : target.pathname) === saved!.href
          );
        });
        const archiveGrid = document.querySelector<HTMLElement>(".upd-toolbar")
          ? document.querySelector<HTMLElement>(".upd-grid")
          : null;
        const loading =
          document.querySelector(".planner-browser .p2-destination-loading") ||
          document.querySelector(
            '.itinerary-library__results[aria-busy="true"]',
          ) ||
          (archiveGrid && archiveGrid.dataset.updArchiveReady !== "true");
        if (
          link &&
          !loading &&
          document.fonts.status !== "loading" &&
          !link.closest("[hidden],.is-hidden")
        ) {
          const target =
            window.scrollY + link.getBoundingClientRect().top - saved!.top;
          if (Math.abs(window.scrollY - target) > 1) {
            holdBrowseRestore(saved!.height);
            window.scrollTo({ top: target, behavior: "instant" });
          }
          if (Math.abs(link.getBoundingClientRect().top - saved!.top) < 2) {
            finishBrowseRestore();
            const corrected =
              window.scrollY + link.getBoundingClientRect().top - saved!.top;
            if (Math.abs(window.scrollY - corrected) > 1)
              window.scrollTo({ top: corrected, behavior: "instant" });
            if (saved!.anchor === "itinerary")
              link.focus({ preventScroll: true });
            try {
              sessionStorage.removeItem("upd:restore-browse");
            } catch {}
            return;
          }
        }
        holdBrowseRestore(saved!.height);
        timer = setTimeout(attempt, 40);
      };
      attempt();
    };
    const shown = (event: PageTransitionEvent) => {
      if (event.persisted || returning) restore();
    };
    const popped = () => restore();
    // Browser Back may reuse a live document, so listen on ordinary first visits too.
    if (returning || history.state?.updBrowsePosition?.url === url) restore();
    window.addEventListener("pageshow", shown);
    window.addEventListener("popstate", popped);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      finishBrowseRestore();
      window.removeEventListener("pageshow", shown);
      window.removeEventListener("popstate", popped);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [path, query, session]);
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
          safeBrowseReturn(
            new URLSearchParams(location.search).get("return_to"),
          ) ||
          browsingTarget(previous) ||
          browsingTarget(document.referrer, true);
        try {
          sessionStorage.setItem(
            "upd:restore-browse",
            target || "/#palawan-map",
          );
        } catch {
          /* Use the safe target without scroll memory. */
        }
        router.push(target || "/#palawan-map");
      }}
    >
      Back
    </button>
  );
}
export function GateUpgrade({ tier }: { tier: Tier }) {
  const path = usePathname();
  const query = useSearchParams();
  return (
    <a
      className="upd-btn upd-btn--vip"
      href={upgradeHref(
        tier,
        query.get("return_to") ||
          (path === "/explorer-plus/"
            ? {
                bucketlist: "/bucketlist/",
                portfolio: "/portfolio/",
                itinerary: "/itineraries/",
              }[query.get("feature") || ""] || "/account/"
            : path + (query.size ? `?${query}` : "")),
      )}
    >
      Upgrade to Explorer+
    </a>
  );
}
