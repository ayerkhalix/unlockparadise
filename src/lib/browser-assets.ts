const pending = new Map<string, Promise<void>>();

/** Load the exact audited browser bundle once; no CDN dependency at runtime. */
export function loadBrowserAsset(src: string): Promise<void> {
  const prior = pending.get(src);
  if (prior) return prior;
  const result = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Unable to load ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
  pending.set(src, result);
  return result;
}
