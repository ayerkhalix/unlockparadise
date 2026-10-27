"use client";
import { useEffect, useRef } from "react";

/** Decorative motion never runs outside the viewport or against user preferences. */
export function useAmbientMotion<T extends HTMLElement>(
  onPlaying?: (playing: boolean) => void,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      const playing = visible && !document.hidden && !reduced.matches;
      el.dataset.playing = String(playing);
      onPlaying?.(playing);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [onPlaying]);
  return ref;
}
