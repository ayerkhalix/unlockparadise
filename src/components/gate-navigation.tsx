"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { safeBrowseReturn } from "@/lib/browsing-return";

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
      if (!link || event.defaultPrevented) return;
      const url = new URL(link.href, location.origin);
      const current = safeBrowseReturn(source());
      if (
        url.origin !== location.origin ||
        !url.pathname.startsWith("/place/") ||
        !current
      )
        return;
      try {
        sessionStorage.setItem(
          storageKey(current),
          JSON.stringify({
            y: window.scrollY,
            href: url.pathname,
            top: link.getBoundingClientRect().top,
            anchor: link.classList.contains("upd-card__link")
              ? "card"
              : link.closest("[data-upd-strip]")
                ? "photo"
                : link.closest("h1,h2,h3")
                  ? "heading"
                  : "other",
          }),
        );
        sessionStorage.setItem("upd:last-browsing-page", current);
      } catch {
        /* Link retains a safe return even without storage. */
      }
      url.searchParams.set("return_to", current);
      link.href = url.pathname + url.search + url.hash;
    };
    document.addEventListener("click", remember);
    return () => document.removeEventListener("click", remember);
  }, []);
  useEffect(() => {
    const url = location.pathname + location.search + location.hash;
    if (!safeBrowseReturn(url)) return;
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
    if (!returning) return;
    let frame = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    const restore = () => {
      let saved: {
        y: number;
        href: string;
        top: number;
        anchor?: string;
      } | null = null;
      try {
        saved = JSON.parse(
          sessionStorage.getItem(`upd:browse-position:${url}`) || "null",
        );
      } catch {
        return;
      }
      if (!saved || !Number.isFinite(saved.y) || !Number.isFinite(saved.top))
        return;
      const started = performance.now();
      let stable = 0;
      const attempt = () => {
        if (cancelled || performance.now() - started > 12000) return;
        const selector =
          saved!.anchor === "card"
            ? "main a.upd-card__link[href]"
            : saved!.anchor === "photo"
              ? "main [data-upd-strip] a[href]"
              : saved!.anchor === "heading"
                ? "main h1 a[href],main h2 a[href],main h3 a[href]"
                : "main a[href]";
        const link = Array.from(
          document.querySelectorAll<HTMLAnchorElement>(selector),
        ).find(
          (a) => new URL(a.href, location.origin).pathname === saved!.href,
        );
        const archiveGrid = document.querySelector<HTMLElement>(".upd-toolbar")
          ? document.querySelector<HTMLElement>(".upd-grid")
          : null;
        const loading =
          document.querySelector(".planner-browser .p2-destination-loading") ||
          (archiveGrid && archiveGrid.dataset.updArchiveReady !== "true");
        if (link && !loading && !link.closest("[hidden],.is-hidden")) {
          const target =
            window.scrollY + link.getBoundingClientRect().top - saved!.top;
          window.scrollTo({ top: target, behavior: "instant" });
          stable++;
          if (stable >= 4) {
            try {
              sessionStorage.removeItem("upd:restore-browse");
            } catch {}
            return;
          }
        }
        timer = setTimeout(attempt, 100);
      };
      frame = requestAnimationFrame(attempt);
    };
    // Runs after source archive filters rebuild their card order, including bfcache.
    timer = setTimeout(restore, 100);
    window.addEventListener("pageshow", restore);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
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
