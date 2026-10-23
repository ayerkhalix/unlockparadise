import { mediaAvailable } from "@/lib/media-availability";
import "server-only";
import { findPlaces, taxonomy } from "./places";
import { serverSupabase } from "@/lib/supabase/server";
import type { MapConfiguration } from "@/components/palawan-map";
import type { SupabaseClient } from "@supabase/supabase-js";
function mapTerms(terms: Awaited<ReturnType<typeof taxonomy>>) {
  return {
    areas: terms.areas
      .filter((a) => a.visible && a.latitude !== null && a.longitude !== null)
      .map((a) => ({
        name: a.name,
        slug: a.slug,
        coords: [Number(a.longitude), Number(a.latitude)],
        desc: a.description,
      })),
    categories: terms.categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      image: mediaAvailable(c.taxonomy_media?.[0]?.media)
        ? `/api/media/${c.taxonomy_media[0].media.id}/`
        : "",
    })),
  };
}
export async function mapMetadata(client: SupabaseClient) {
  return mapTerms(await taxonomy(client));
}
export async function mapConfiguration(
  client?: SupabaseClient,
): Promise<MapConfiguration> {
  const db = client || (await serverSupabase());
  const [terms, summary] = await Promise.all([
    taxonomy(db),
    findPlaces({ limit: 500 }, db),
  ]);
  const places = summary;
  const availability: Record<string, Record<string, number>> = {};
  const categoryCounts: Record<string, number> = {};
  for (const place of places)
    for (const category of place.place_categories)
      categoryCounts[category.categories.slug] =
        (categoryCounts[category.categories.slug] || 0) + 1;
  for (const place of places)
    for (const area of place.place_areas)
      for (const category of place.place_categories) {
        availability[area.areas.slug] ??= {};
        availability[area.areas.slug][category.categories.slug] =
          (availability[area.areas.slug][category.categories.slug] || 0) + 1;
      }
  return {
    ...mapTerms(terms),
    availability,
    categoryCounts,
  };
}
