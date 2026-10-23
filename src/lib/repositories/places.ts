import "server-only";
import { serverSupabase } from "@/lib/supabase/server";
import { databaseError } from "@/lib/http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSession } from "@/lib/auth/session";
export interface PlaceSummary {
  id: string;
  legacy_id: number | null;
  slug: string;
  title: string;
  vip_content: boolean;
  travel_minutes: number | null;
  accessibility: string[];
  assets: string[];
  published_at: string | null;
  featured: boolean;
  feature_order: number;
  rating_average?: number;
  rating_count?: number;
  saved?: boolean;
  visited?: boolean;
  place_details?: {
    hike_minutes: number | null;
    transport_minutes: Record<string, number | null>;
  } | null;
  place_areas: { areas: { id: string; slug: string; name: string } }[];
  place_categories: {
    categories: { id: string; slug: string; name: string };
  }[];
  place_media: {
    kind: string;
    position: number;
    media: { id: string; status: string; alt: string } | null;
  }[];
}
export async function findPlaces(
  filters: {
    area?: string;
    category?: string;
    search?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    memberState?: boolean;
    personalized?: boolean;
  } = {},
  client?: SupabaseClient,
): Promise<PlaceSummary[]> {
  const db = client || (await serverSupabase());
  const query = filters.personalized
    ? db
        .rpc("traveler_featured", { max_results: filters.limit || 4 })
        .select(
          "id,legacy_id,slug,title,vip_content,travel_minutes,accessibility,assets,published_at,featured,feature_order,place_areas(areas(id,slug,name)),place_categories(categories(id,slug,name)),place_media(kind,position,media(id,status,alt)),reviews(rating,status),place_details(hike_minutes,transport_minutes)",
        )
    : db.rpc("browse_places", {
        area_slug: filters.area || null,
        category_slug: filters.category || null,
        search_text: filters.search || null,
        featured_only: filters.featured || false,
        max_results: filters.limit || 100,
        page_offset: filters.offset || 0,
      });
  const result = await query;
  databaseError(result.error);
  const rows = (result.data || []) as unknown as (PlaceSummary & {
    reviews: { rating: number; status: string }[];
  })[];
  const current =
    filters.memberState && !client ? await currentSession() : null;
  const state =
    current?.premium && rows.length
      ? await current.db
          .from("member_places")
          .select("place_id,saved_at,visited_at")
          .eq("user_id", current.user.id)
          .in(
            "place_id",
            rows.map((row) => row.id),
          )
      : null;
  databaseError(state?.error || null);
  return rows.map((place) => {
    const { reviews, ...summary } = place;
    const approved = (reviews || []).filter(
      (r: { status: string }) => r.status === "approved",
    );
    return {
      ...summary,
      saved: Boolean(
        state?.data?.find((s) => s.place_id === place.id)?.saved_at,
      ),
      visited: Boolean(
        state?.data?.find((s) => s.place_id === place.id)?.visited_at,
      ),
      rating_count: approved.length,
      rating_average: approved.length
        ? approved.reduce(
            (sum: number, r: { rating: number }) => sum + r.rating,
            0,
          ) / approved.length
        : 0,
    };
  }) as unknown as PlaceSummary[];
}
export async function taxonomy(client?: SupabaseClient) {
  const db = client || (await serverSupabase());
  const results = await Promise.all([
    db.from("areas").select("*").order("display_order").order("name"),
    db
      .from("categories")
      .select("*,taxonomy_media(media(id,status))")
      .order("display_order")
      .order("name"),
  ]);
  results.forEach((r) => databaseError(r.error));
  return { areas: results[0].data || [], categories: results[1].data || [] };
}
