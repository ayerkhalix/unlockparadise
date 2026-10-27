import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { databaseError } from "@/lib/http";
import { associationFocalPoint, withFocalPoint } from "@/lib/focal-point";
import {
  itineraryLibraryPageSize,
  type LibraryFilters,
  type ItineraryLibraryResult,
} from "@/lib/itinerary-library";

const photos = "kind,focal_x,focal_y,media!inner(id,status)";
type Photo = {
  focal_x: number | null;
  focal_y: number | null;
  media: { id: string; status: string };
};
const image = (photo: Photo | undefined) =>
  photo
    ? withFocalPoint(
        `/api/media/${photo.media.id}/?variant=medium_large`,
        associationFocalPoint({
          focal_x: photo.focal_x ?? undefined,
          focal_y: photo.focal_y ?? undefined,
        }),
      )
    : null;

/** Owner-scoped, bounded summaries: no notes, times, guides or coordinates. */
export async function getItineraryLibrary(
  db: SupabaseClient,
  owner: string,
  filters: LibraryFilters,
): Promise<ItineraryLibraryResult> {
  const owned = (columns: string, count = false, applyFilters = true) => {
    let query = db
      .from("itineraries")
      .select(columns, count ? { count: "exact", head: true } : {})
      .eq("user_id", owner);
    if (applyFilters && filters.area === "unassigned")
      query = query.is("area_id", null);
    else if (applyFilters && filters.area)
      query = query.eq("area_id", filters.area);
    if (applyFilters && filters.q)
      query = query.ilike("title", `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
    return query;
  };
  const [matching, all, areaResult] = await Promise.all([
    owned("id", true),
    owned("id", true, false),
    db
      .from("areas")
      .select(`id,name,place_areas(places!inner(place_media!inner(${photos})))`)
      .eq("place_areas.places.status", "publish")
      .eq("place_areas.places.place_media.kind", "cover")
      .in("place_areas.places.place_media.media.status", ["ready", "legacy"])
      .limit(1, { referencedTable: "place_areas" })
      .order("display_order")
      .order("name"),
  ]);
  [matching, all, areaResult].forEach((result) => databaseError(result.error));
  const count = matching.count || 0;
  const pages = Math.max(1, Math.ceil(count / itineraryLibraryPageSize));
  const page = Math.min(filters.page, pages);
  let query = owned(
    "id,title,area_id,start_date,end_date,areas(name),days:itinerary_days(count),stops:itinerary_items(count)",
  );
  if (filters.sort === "name") query = query.order("title");
  else if (filters.sort === "date")
    query = query.order("start_date", { ascending: true, nullsFirst: false });
  else query = query.order("updated_at", { ascending: false });
  const result = await query
    .order("id")
    .range(
      (page - 1) * itineraryLibraryPageSize,
      page * itineraryLibraryPageSize - 1,
    );
  databaseError(result.error);
  // PostgREST keeps these nested relations bounded independently of counts.
  const areas = (areaResult.data || []) as unknown as {
    id: string;
    name: string;
    place_areas: { places: { place_media: Photo[] } }[];
  }[];
  const rows = (result.data || []) as unknown as {
    id: string;
    title: string;
    area_id: string | null;
    start_date: string | null;
    end_date: string | null;
    areas: { name: string } | null;
    days: { count: number }[];
    stops: { count: number }[];
  }[];
  const covers = new Map<string, string[]>();
  // Page stop metadata independently: repeated visits must not truncate later destinations.
  if (rows.length)
    for (let offset = 0; ; offset += 500) {
      const batch = await db
        .from("itinerary_items")
        .select(
          `id,itinerary_id,position,itinerary_days(day_number),places!inner(id,place_media!inner(${photos}))`,
        )
        .in(
          "itinerary_id",
          rows.map((row) => row.id),
        )
        .eq("places.status", "publish")
        .eq("places.place_media.kind", "cover")
        .in("places.place_media.media.status", ["ready", "legacy"])
        .order("itinerary_id")
        .order("itinerary_days(day_number)")
        .order("position")
        .order("id")
        .order("position", { referencedTable: "places.place_media" })
        .limit(1, { referencedTable: "places.place_media" })
        .range(offset, offset + 499);
      databaseError(batch.error);
      const stops = (batch.data || []) as unknown as {
        itinerary_id: string;
        places: { place_media: Photo[] };
      }[];
      for (const stop of stops) {
        const src = image(stop.places.place_media[0]);
        const list = covers.get(stop.itinerary_id) || [];
        if (src && !list.includes(src)) list.push(src);
        covers.set(stop.itinerary_id, list);
      }
      if (stops.length < 500) break;
    }
  return {
    data: rows.map((row) => {
      const destinationPhotos = covers.get(row.id) || [];
      const fallback = image(
        areas.find((area) => area.id === row.area_id)?.place_areas[0]?.places
          .place_media[0],
      );
      const images = destinationPhotos.length
        ? destinationPhotos
        : fallback
          ? [fallback]
          : [];
      return {
        id: row.id,
        title: row.title,
        area_id: row.area_id,
        area: row.areas?.name || "Area not selected",
        start_date: row.start_date,
        end_date: row.end_date,
        day_count: row.days[0]?.count || 0,
        stop_count: row.stops[0]?.count || 0,
        image: images[0] || null,
        images,
      };
    }),
    areas: areas.map(({ id, name }) => ({ id, name })),
    count,
    total: all.count || 0,
    page,
    pages,
    pageSize: itineraryLibraryPageSize,
  };
}
