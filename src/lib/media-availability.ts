// Legacy metadata is usable without claiming that a Storage upload was verified.
export function mediaAvailable<T extends { status?: unknown }>(media: T | null | undefined): media is T {
  return media?.status === "ready" || media?.status === "legacy";
}

export function legacyPublicUrl(base: string, relative: string) {
  if (!relative || relative.startsWith("/") || relative.includes("\\") || relative.split("/").some(p => !p || p === "." || p === "..") || /[?#%\u0000-\u001f]/.test(relative))
    throw new Error("Invalid legacy media path");
  const root = new URL(base.endsWith("/") ? base : base + "/");
  if (root.protocol !== "https:" || root.username || root.password || root.search || root.hash)
    throw new Error("Invalid legacy media base URL");
  return new URL(relative.split("/").map(encodeURIComponent).join("/"), root).href;
}
