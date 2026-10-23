"use client";
import { useEffect } from "react";

/** The source filter is DOM-only: sort/search/facets/history, with zero API requests. */
export function ArchiveBehavior() {
  useEffect(() => {
    const id = "original-area-filter";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = "/original/area-filter.js";
    document.body.appendChild(script);
  }, []);
  return null;
}
