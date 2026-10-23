import "server-only";
import { cache } from "react";
import { ApiError } from "./http";
import {
  googleMapsUrl,
  googlePlaceId,
  mapsLookup,
  type GooglePlacePreview,
} from "./nearby-places";

export function googlePlacesConfigured() {
  return !!process.env.GOOGLE_PLACES_API_KEY?.trim();
}
type GoogleRow = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  photos?: {
    name?: string;
    googleMapsUri?: string;
    authorAttributions?: {
      displayName?: string;
      uri?: string;
      photoUri?: string;
    }[];
  }[];
  attributions?: { provider?: string; providerUri?: string }[];
};
function httpsLink(value?: string): string | null {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
async function googleRequest(path: string, fields: string, body?: unknown) {
  if (!googlePlacesConfigured())
    throw new ApiError(
      503,
      "Google photo lookup is not set up yet. You can still save a name and Google Maps link.",
    );
  const response = await fetch("https://places.googleapis.com/v1/" + path, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(6500),
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      ...(fields ? { "X-Goog-FieldMask": fields } : {}),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new ApiError(
      502,
      "Google Maps could not load this place. Check the link or try again later.",
    );
  return response.json();
}
const fields =
  "id,displayName,formattedAddress,googleMapsUri,photos,attributions";
async function preview(row: GoogleRow): Promise<GooglePlacePreview> {
  const photo = row.photos?.[0];
  let photoUrl: string | null = null;
  if (
    photo?.name &&
    /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)
  ) {
    try {
      const media = await googleRequest(
        photo.name + "/media?maxWidthPx=640&skipHttpRedirect=true",
        "",
      );
      const url = new URL(media.photoUri);
      if (
        url.protocol === "https:" &&
        /(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname)
      )
        photoUrl = url.href;
    } catch {
      /* A place without an available photo still has a useful Maps link. */
    }
  }
  return {
    id: row.id,
    name: row.displayName?.text || "",
    address: row.formattedAddress || "",
    mapsUrl:
      googleMapsUrl(row.googleMapsUri || "")?.href ||
      `https://www.google.com/maps/search/?api=1&query=Place&query_place_id=${encodeURIComponent(row.id)}`,
    photo: photoUrl,
    photoMapsUrl: googleMapsUrl(photo?.googleMapsUri || "")?.href || null,
    authors: (photo?.authorAttributions || []).map((a) => ({
      name: a.displayName || "Photo contributor",
      uri: httpsLink(a.uri),
      avatar: httpsLink(a.photoUri),
    })),
    attributions: (row.attributions || []).map((a) => ({
      name: a.provider || "Data provider",
      uri: httpsLink(a.providerUri),
    })),
  };
}
// React cache deduplicates within this render only. Never persist Google photo names or content.
export const googlePlacePreview = cache(
  async (id: string): Promise<GooglePlacePreview> => {
    googlePlaceId.parse(id);
    return preview(
      await googleRequest("places/" + encodeURIComponent(id), fields),
    );
  },
);
export async function lookupGoogleMaps(
  value: string,
): Promise<GooglePlacePreview[]> {
  if (!googlePlacesConfigured())
    throw new ApiError(
      503,
      "Google photo lookup is not set up yet. You can still save a name and Google Maps link.",
    );
  let url = googleMapsUrl(value);
  if (!url) throw new ApiError(400, "Paste an HTTPS Google Maps place link.");
  // Expand share links, validating every redirect before any network request.
  if (url.hostname.endsWith("goo.gl")) {
    for (let hops = 0; hops < 5; hops++) {
      const response = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) break;
      const next = googleMapsUrl(new URL(location, url).href);
      if (!next)
        throw new ApiError(
          400,
          "This link does not lead to a Google Maps place.",
        );
      url = next;
      if (!url.hostname.endsWith("goo.gl")) break;
    }
  }
  let lookup: ReturnType<typeof mapsLookup>;
  try {
    lookup = mapsLookup(url);
  } catch {
    throw new ApiError(
      400,
      "This Google Maps link could not be read. Copy the place’s Share link again.",
    );
  }
  if (lookup.id) return [await googlePlacePreview(lookup.id)];
  if (!lookup.query)
    throw new ApiError(
      400,
      "This link has no place name. Copy the place’s Share link from Google Maps.",
    );
  const found = await googleRequest(
    "places:searchText",
    "places." + fields.split(",").join(",places."),
    { textQuery: lookup.query, pageSize: 3, regionCode: "PH" },
  );
  return Promise.all((found.places || []).map((p: GoogleRow) => preview(p)));
}
