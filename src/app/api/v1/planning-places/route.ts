import { z } from "zod";
import { api, json, databaseError } from "@/lib/http";
import { requirePremium } from "@/lib/auth/session";
import { mapMetadata } from "@/lib/repositories/maps";
import {
  planningPlace,
  planningPlaceSelect,
} from "@/lib/repositories/planning";
export async function GET(request: Request) {
  return api(async () => {
    const { db } = await requirePremium(request);
    const url = new URL(request.url);
    const search = z
      .string()
      .max(200)
      .parse(url.searchParams.get("search") || "");
    const [result, map] = await Promise.all([
      db
        .rpc("find_places", {
          area_slug: url.searchParams.get("area") || null,
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
    return json({
      map,
      data: (Array.isArray(result.data) ? result.data : [])
        .map(planningPlace)
        .filter(Boolean),
    });
  });
}
