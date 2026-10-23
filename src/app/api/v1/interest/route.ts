import { z } from "zod";
import {
  api,
  ApiError,
  databaseError,
  input,
  json,
  verifyOrigin,
} from "@/lib/http";
import { serverSupabase, privilegedSupabase } from "@/lib/supabase/server";
import { session } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
const event = z
  .object({
    event_id: z.string().uuid(),
    session_id: z.string().uuid(),
    name: z.enum([
      "place_viewed",
      "place_saved",
      "place_removed_from_bucketlist",
      "place_added_to_itinerary",
      "itinerary_created",
      "product_viewed",
      "product_added_to_bag",
    ]),
    place_id: z.string().uuid().optional(),
    product_id: z.number().int().positive().optional(),
    consent: z.literal(true),
  })
  .strict();
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const body = await input(request, event, 4096);
    await rateLimit(
      "interest",
      request.headers.get("x-forwarded-for")?.split(",")[0] || body.session_id,
      120,
      60,
    );
    const db = await serverSupabase(request);
    if (body.name.startsWith("place_")) {
      if (!body.place_id || body.product_id)
        throw new ApiError(400, "Choose a Place.");
      const place = await db
        .from("places")
        .select("id")
        .eq("id", body.place_id)
        .eq("status", "publish")
        .maybeSingle();
      databaseError(place.error);
      if (!place.data) throw new ApiError(404, "Place unavailable.");
      if (body.name !== "place_viewed") {
        const current = await session(request);
        if (!current) throw new ApiError(401, "Sign in to record this action.");
        if (body.name === "place_added_to_itinerary") {
          const item = await current.db
            .from("itinerary_items")
            .select("id")
            .eq("place_id", body.place_id)
            .limit(1);
          databaseError(item.error);
          if (!item.data?.length)
            throw new ApiError(400, "No saved itinerary addition.");
        } else {
          const saved = await current.db
            .from("member_places")
            .select("saved_at")
            .eq("user_id", current.user.id)
            .eq("place_id", body.place_id)
            .maybeSingle();
          databaseError(saved.error);
          if (
            (body.name === "place_saved" && !saved.data?.saved_at) ||
            (body.name === "place_removed_from_bucketlist" &&
              saved.data?.saved_at)
          )
            throw new ApiError(
              400,
              "The saved state does not match this event.",
            );
        }
      }
    } else if (body.name.startsWith("product_")) {
      if (!body.product_id || body.place_id)
        throw new ApiError(400, "Choose a product.");
      const product = await db
        .from("merch_products")
        .select("id")
        .eq("id", body.product_id)
        .eq("status", "publish")
        .maybeSingle();
      databaseError(product.error);
      if (!product.data) throw new ApiError(404, "Product unavailable.");
    } else {
      if (body.place_id || body.product_id)
        throw new ApiError(400, "Unexpected entity.");
      const current = await session(request);
      if (!current) throw new ApiError(401, "Sign in to record this action.");
      const trip = await current.db
        .from("itineraries")
        .select("id")
        .gte("created_at", new Date(Date.now() - 120000).toISOString())
        .limit(1);
      databaseError(trip.error);
      if (!trip.data?.length)
        throw new ApiError(400, "No recent trip creation.");
    }
    const result = await privilegedSupabase()
      .from("analytics_events")
      .insert({
        event_id: body.event_id,
        session_id: body.session_id,
        name: body.name,
        place_id: body.place_id || null,
        product_id: body.product_id || null,
      });
    if (result.error?.code !== "23505") databaseError(result.error);
    return json({ recorded: true });
  });
}
