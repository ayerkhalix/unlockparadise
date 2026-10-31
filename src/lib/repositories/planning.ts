import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, databaseError } from "@/lib/http";
import { mediaAvailable } from "@/lib/media-availability";
import type { TravelPlace, Trip } from "@/lib/planning";
import { withFocalPoint, associationFocalPoint } from "@/lib/focal-point";

export const planningPlaceSelect =
  "id,slug,title,vip_content,status,accessibility,assets,published_at,reviews(rating,status),travel_minutes,place_areas(areas(id,name,slug)),place_categories(categories(name,slug)),place_media(kind,position,focal_x,focal_y,media(id,status)),place_details(latitude,longitude,access_points)";
type PlaceRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  vip_content: boolean;
  accessibility: string[];
  assets?: string[];
  published_at?: string;
  reviews?: { rating: number; status: string }[];
  travel_minutes: number | null;
  place_areas: { areas: { id: string; name: string; slug: string } }[];
  place_categories: { categories: { name: string; slug: string } }[];
  place_media: {
    kind: string;
    position?: number;
    focal_x?: number;
    focal_y?: number;
    media: { id: string; status: string } | null;
  }[];
  place_details: {
    latitude: number | null;
    longitude: number | null;
    access_points?: import("../access-points").AccessPoint[];
  } | null;
};
export function planningPlace(row: unknown): TravelPlace | null {
  const p = row as PlaceRow | null;
  if (!p || p.status !== "publish" || !p.place_details) return null;
  const photo = p.place_media.find(
    (m) => m.kind === "cover" && mediaAvailable(m.media),
  );
  return {
    id: p.id,
    areaIds: p.place_areas.map((a) => a.areas.id),
    accessibility: p.accessibility,
    assets: p.assets || [],
    vip: p.vip_content,
    publishedAt: p.published_at,
    rating: (() => {
      const approved = (p.reviews || []).filter((r) => r.status === "approved");
      return approved.length
        ? approved.reduce((sum, r) => sum + r.rating, 0) / approved.length
        : null;
    })(),
    travelMinutes: p.travel_minutes,
    slug: p.slug,
    title: p.title,
    area: p.place_areas.map((a) => a.areas.name).join(" · "),
    category: p.place_categories.map((c) => c.categories.name).join(" · "),
    image: photo?.media
      ? withFocalPoint(
          `/api/media/${photo.media.id}/?variant=medium_large`,
          associationFocalPoint(photo),
        )
      : null,
    images: [
      ...new Map(
        p.place_media
          .filter(
            (m) =>
              ["cover", "gallery"].includes(m.kind) && mediaAvailable(m.media),
          )
          .sort(
            (a, b) =>
              Number(b.kind === "cover") - Number(a.kind === "cover") ||
              (a.position || 0) - (b.position || 0),
          )
          .map((m) => [
            m.media!.id,
            withFocalPoint(
              `/api/media/${m.media!.id}/?variant=medium_large`,
              associationFocalPoint(m),
            ),
          ]),
      ).values(),
    ],
    accessPoints: p.place_details.access_points || [],
    coordinates:
      p.place_details.longitude != null && p.place_details.latitude != null
        ? [Number(p.place_details.longitude), Number(p.place_details.latitude)]
        : null,
  };
}
export async function getTrip(
  db: SupabaseClient,
  userId: string,
  id: string,
): Promise<Trip> {
  const result = await db
    .from("itineraries")
    .select("*,areas(id,name,slug),itinerary_days(*)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(result.error);
  if (!result.data) throw new ApiError(404, "This itinerary is unavailable.");
  const items = await db
    .from("itinerary_items")
    .select(`*,places(${planningPlaceSelect})`)
    .eq("itinerary_id", id)
    .order("position");
  databaseError(items.error);
  return {
    ...result.data,
    itinerary_days: result.data.itinerary_days.sort(
      (a: { day_number: number }, b: { day_number: number }) =>
        a.day_number - b.day_number,
    ),
    items: (items.data || []).map(({ places, ...item }) => ({
      ...item,
      place: planningPlace(places),
    })),
  };
}
export function planningError(
  error: { code?: string; message?: string } | null,
) {
  if (error?.code === "PT422")
    throw new ApiError(422, error.message || "Check your trip area.");
  if (error?.code === "40001" || error?.code === "PT409")
    throw new ApiError(
      409,
      "This trip changed in another window. Reload the plan and try again.",
    );
  if (error?.code === "P0002" || error?.code === "PT404")
    throw new ApiError(404, "This itinerary is unavailable.");
  if (error?.code === "23503")
    throw new ApiError(
      409,
      "Move or remove stops from the last days before shortening this trip.",
    );
  if (error?.code === "23505")
    throw new ApiError(409, "This Place is already on that day.");
  databaseError(error);
}
