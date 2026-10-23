import { z } from "zod";

const mapsHosts = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "google.com.ph",
  "www.google.com.ph",
  "maps.google.com.ph",
  "maps.app.goo.gl",
  "goo.gl",
]);

/** Only Google Maps share/profile URLs may ever be followed by the server. */
export function googleMapsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !mapsHosts.has(url.hostname)
    )
      return null;
    if (url.hostname === "goo.gl" && !url.pathname.startsWith("/maps/"))
      return null;
    if (
      !url.hostname.endsWith("goo.gl") &&
      !url.hostname.startsWith("maps.") &&
      !/^\/maps(?:\/|$)/.test(url.pathname)
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
export const googlePlaceId = z.string().regex(/^[A-Za-z0-9_-]{10,255}$/);
export const nearbyKinds = [
  "food",
  "coffee",
  "stay",
  "activity",
  "other",
] as const;
export const nearbyKindLabels: Record<(typeof nearbyKinds)[number], string> = {
  food: "Food",
  coffee: "Coffee",
  stay: "Stay",
  activity: "Things to do",
  other: "Local stop",
};
export const nearbyPlaceInput = z
  .object({
    id: z.uuid(),
    name: z
      .string()
      .trim()
      .min(1, "Add a name for this nearby place.")
      .max(160),
    maps_url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (v) => !!googleMapsUrl(v),
        "Paste an HTTPS Google Maps place link.",
      ),
    google_place_id: z.union([googlePlaceId, z.literal("")]).default(""),
    kind: z.enum(nearbyKinds),
    note: z.string().trim().max(500).default(""),
  })
  .strict();
export const nearbyPlacesInput = z
  .array(nearbyPlaceInput)
  .max(6)
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.google_place_id || r.maps_url)).size ===
        rows.length && new Set(rows.map((r) => r.id)).size === rows.length,
    "Choose each nearby place once.",
  );
export type NearbyPlace = z.infer<typeof nearbyPlaceInput>;
export type GooglePlacePreview = {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
  photo: string | null;
  photoMapsUrl?: string | null;
  authors: { name: string; uri: string | null; avatar?: string | null }[];
  attributions: { name: string; uri: string | null }[];
};
export function mapsLookup(url: URL): { id?: string; query?: string } {
  const direct =
    url.searchParams.get("query_place_id") ||
    url.searchParams.get("place_id") ||
    /!1s([A-Za-z0-9_-]{10,255})(?:!|$)/.exec(
      decodeURIComponent(url.pathname + url.search),
    )?.[1] ||
    /^place_id:([A-Za-z0-9_-]+)$/.exec(url.searchParams.get("q") || "")?.[1];
  if (direct && googlePlaceId.safeParse(direct).success) return { id: direct };
  const name = /\/maps\/place\/([^/]+)/.exec(url.pathname)?.[1];
  const query = name
    ? decodeURIComponent(name.replaceAll("+", " "))
    : url.searchParams.get("query") || url.searchParams.get("q");
  return query && !/^[-\d.,\s]+$/.test(query)
    ? { query: query.slice(0, 240) }
    : {};
}
