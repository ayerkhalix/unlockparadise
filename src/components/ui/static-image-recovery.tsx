"use client";
import { useEffect } from "react";

/** One adapter for retained server HTML; React-owned images use ContentImage. */
export function StaticImageRecovery() {
  useEffect(() => {
    const recover = (image: HTMLImageElement) => {
      const source = image.dataset.imageOriginal;
      if (
        !source?.startsWith("/") ||
        source.startsWith("//") ||
        !image.isConnected
      )
        return;
      const original = new URL(source, location.origin).href;
      if (
        !image.dataset.imageRetried &&
        image.currentSrc !== original &&
        image.src !== original
      ) {
        image.dataset.imageRetried = "true";
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
        image.src = source;
        return;
      }
      const fallback = document.createElement("span");
      fallback.className = `${image.className} p2-photo-fallback`;
      fallback.textContent = "Photo unavailable";
      if (image.alt) {
        fallback.role = "img";
        fallback.setAttribute("aria-label", `${image.alt} — photo unavailable`);
      } else fallback.setAttribute("aria-hidden", "true");
      image.replaceWith(fallback);
    };
    const error = (event: Event) => {
      if (
        event.target instanceof HTMLImageElement &&
        event.target.hasAttribute("data-image-original")
      )
        recover(event.target);
    };
    const scan = (node: Node) => {
      if (!(node instanceof Element)) return;
      const images =
        node instanceof HTMLImageElement
          ? [node]
          : node.querySelectorAll<HTMLImageElement>("img[data-image-original]");
      for (const image of images)
        if (image.complete && !image.naturalWidth) recover(image);
    };
    document.addEventListener("error", error, true);
    scan(document.documentElement);
    const observer = new MutationObserver((records) =>
      records.forEach((record) => record.addedNodes.forEach(scan)),
    );
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("error", error, true);
      observer.disconnect();
    };
  }, []);
  return null;
}
