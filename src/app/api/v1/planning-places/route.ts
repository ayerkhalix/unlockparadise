import { z } from "zod";
import { api, json, databaseError, ApiError } from "@/lib/http";
import { requirePremium } from "@/lib/auth/session";
import { mapMetadata } from "@/lib/repositories/maps";
import {
  planningPlace,
  planningPlaceSelect,
} from "@/lib/repositories/planning";
export async function GET(request: Request) {
  return api(async () => {
    const { db, user } = await requirePremium(request);
    const url = new URL(request.url);
    let areaSlug = url.searchParams.get("area") || null;
    const tripId = url.searchParams.get("trip");
    if (tripId) {
      z.uuid().parse(tripId);
      const trip = await db
        .from("itineraries")
        .select("area_id,areas(slug)")
        .eq("id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();
      databaseError(trip.error);
      if (!trip.data) throw new ApiError(404, "This itinerary is unavailable.");
      if (!trip.data.area_id)
        throw new ApiError(
          409,
          "Choose an area in Edit trip before adding destinations.",
        );
      areaSlug = (trip.data.areas as unknown as { slug: string }).slug;
    }
    const search = z
      .string()
      .max(200)
      .parse(url.searchParams.get("search") || "");
    const [result, map] = await Promise.all([
      db
        .rpc("find_places", {
          area_slug: areaSlug,
          category_slug: url.searchParams.get("category") || null,
          search_text: search || null,
          featured_only: false,
          max_results: 500,
          page_offset: 0,
        })
        .select(planningPlaceSelect),
      mapMetadata(db),
    ]);
    databaseError(result.error);
    const rows = Array.isArray(result.data) ? [...result.data] : [];
    let pageSize = rows.length;
    let offset = rows.length;
    while (pageSize === 500) {
      const next = await db
        .rpc("find_places", {
          area_slug: areaSlug,
          category_slug: url.searchParams.get("category") || null,
          search_text: search || null,
          featured_only: false,
          max_results: 500,
          page_offset: offset,
        })
        .select(planningPlaceSelect);
      databaseError(next.error);
      const page = Array.isArray(next.data) ? next.data : [];
      rows.push(...page);
      pageSize = page.length;
      offset += page.length;
    }
    return json({
      map,
      data: rows.map(planningPlace).filter(Boolean),
    });
  });
}
