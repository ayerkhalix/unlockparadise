"use client";
import { useEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { cancelFlights } from "@/lib/travel-motion";

// Keep the dock reachable whenever it has space, without covering a real action.
export function useFloatingClearance(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const pathname = usePathname();
  useEffect(() => {
    const dock = ref.current;
    if (!enabled || !dock) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!dock.isConnected) return;
      const r = dock.getBoundingClientRect();
      if (dock.contains(document.activeElement)) return;
      const previous =
        parseFloat(dock.style.getPropertyValue("--p2-dock-lift")) || 0;
      const base = { top: r.top + previous, bottom: r.bottom + previous };
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]),select,textarea,button,summary,footer a,.p2-button,.p2-back,.p2-merch-nav a,.p2-product-card__info,.p2-product-card__link > p,[data-dock-clearance]',
        ),
      ].flatMap((control) => {
        if (
          dock.contains(control) ||
          control.closest("dialog,.p2-notices,.mapboxgl-ctrl")
        )
          return [];
        const c = control.getBoundingClientRect();
        if (
          !c.width ||
          !c.height ||
          c.right + 8 <= r.left ||
          c.left - 8 >= r.right
        )
          return [];
        const style = getComputedStyle(control);
        return style.visibility !== "hidden" && style.display !== "none"
          ? [c]
          : [];
      });
      let lift = 0;
      const maximum = Math.max(0, base.top - 96);
      while (
        lift <= maximum &&
        controls.some(
          (c) =>
            c.bottom + 8 > base.top - lift && c.top - 8 < base.bottom - lift,
        )
      )
        lift += r.height + 16;
      const blocked = lift > maximum;
      if (blocked && dock.dataset.obstructed !== "true") {
        dock.dataset.obstructed = "true";
        cancelFlights();
      } else if (!blocked) {
        delete dock.dataset.obstructed;
        if (lift !== previous) {
          cancelFlights();
          dock.style.setProperty("--p2-dock-lift", `${lift}px`);
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    observer.observe(dock);
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    window.addEventListener("upd:before-flight", measure);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      delete dock.dataset.obstructed;
      dock.style.removeProperty("--p2-dock-lift");
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      window.removeEventListener("upd:before-flight", measure);
    };
  }, [enabled, pathname, ref]);
}
