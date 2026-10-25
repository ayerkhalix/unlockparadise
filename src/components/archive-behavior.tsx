"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** The source filter is DOM-only: sort/search/facets/history, with zero API requests. */
export function ArchiveBehavior() {
  const pathname = usePathname();
  useEffect(() => {
    const initialize = () =>
      (
        window as Window & { UPDAreaFilter?: { init: () => void } }
      ).UPDAreaFilter?.init();
    const controller = (
      window as Window & { UPDAreaFilter?: { init: () => void } }
    ).UPDAreaFilter;
    if (controller) {
      controller.init();
      return;
    }
    const id = "original-area-filter";
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener("load", initialize);
      return () => existing.removeEventListener("load", initialize);
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = "/original/area-filter.js";
    document.body.appendChild(script);
  }, [pathname]);
  return null;
}
