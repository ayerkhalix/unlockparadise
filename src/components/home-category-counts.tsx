"use client";

import { useEffect } from "react";
import type { MapConfiguration } from "./palawan-map";

/** Live counts enhance the static hero without delaying its first paint. */
export function HomeCategoryCounts({ data }: { data: MapConfiguration }) {
  useEffect(() => {
    for (const chip of document.querySelectorAll<HTMLElement>(
      "[data-home-category]",
    )) {
      const category = data.categories.find(
        (c) => c.slug === chip.dataset.homeCategory,
      );
      if (!category) continue;
      const count = data.categoryCounts?.[category.slug] || 0;
      chip.dataset.tooltip = `${count} ${category.name}`;
      chip.setAttribute(
        "aria-label",
        `${category.name}: ${count} destinations`,
      );
    }
  }, [data]);
  return null;
}
