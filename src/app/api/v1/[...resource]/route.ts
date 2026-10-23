import { z } from "zod";
import {
  api,
  ApiError,
  input,
  json,
  verifyOrigin,
  databaseError,
} from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { serverSupabase, privilegedSupabase } from "@/lib/supabase/server";
import { findPlaces, taxonomy } from "@/lib/repositories/places";
import { mapConfiguration } from "@/lib/repositories/maps";
import { profileInput, reviewInput, uuid } from "@/lib/validation";
import { safeHtml } from "@/lib/html";
import { rateLimit } from "@/lib/rate-limit";
import { publicTravelerBadges } from "@/lib/repositories/traveler";
import {
  planningPlace,
  planningPlaceSelect,
} from "@/lib/repositories/planning";
type Context = { params: Promise<{ resource: string[] }> };
const filters = z.object({
  area: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export async function GET(request: Request, { params }: Context) {
  return api(async () => {
    const { resource } = await params;
    const path = resource.join("/");
    const db = await serverSupabase(request);
    const url = new URL(request.url);
    if (path === "places")
      return json({
        data: await findPlaces(
          filters.parse(Object.fromEntries(url.searchParams)),
          db,
        ),
      });
    if (path === "areas" || path === "categories" || path === "maps") {
      if (path === "maps") {
        return json(await mapConfiguration(db));
      }
      const data = await taxonomy(db);
      return json({ data: data[path] });
    }
    if (resource[0] === "places" && resource[1]) {
      const query = await db
        .from("places")
        .select(
          "id,legacy_id,slug,title,vip_content,travel_minutes,accessibility,assets,place_details(*),place_media(kind,position,media(id,status))",
        )
        .eq(
          z.uuid().safeParse(resource[1]).success ? "id" : "slug",
          resource[1],
        )
        .maybeSingle();
      databaseError(query.error);
      if (!query.data) {
        const locked = await db.rpc("locked_place", {
          identifier: resource[1],
        });
        databaseError(locked.error);
        if (locked.data)
          return json({ data: locked.data, access: "restricted" }, 403);
        throw new ApiError(404, "Place not found.");
      }
      if (!query.data.place_details)
        return json(
          {
            data: {
              id: query.data.id,
              slug: query.data.slug,
              title: query.data.vip_content ? "Explorer+" : query.data.title,
              vip_content: query.data.vip_content,
            },
            access: "restricted",
          },
          403,
        );
      return json({ data: query.data });
    }
    if (path === "reviews") {
      const pid = uuid.parse(url.searchParams.get("place_id"));
      const result = await db
        .from("reviews")
        .select("id,user_id,author_name,rating,title,body,status,created_at")
        .eq("place_id", pid)
        .order("created_at", { ascending: false })
        .limit(100);
      databaseError(result.error);
      const badges = await publicTravelerBadges(
        db,
        (result.data || []).map((r) => r.id),
      );
      return json({
        data: (result.data || []).map((r) => ({
          ...r,
          body: safeHtml(r.body),
          traveler_identity: badges.find((b) => b.review_id === r.id),
        })),
      });
    }
    const current = await requireSession(request);
    if (path === "me") {
      const result = await current.db
        .from("profiles")
        .select("*")
        .eq("id", current.user.id)
        .single();
      databaseError(result.error);
      return json({
        data: result.data,
        access: {
          premium: current.premium,
          staff: current.staff,
          admin: current.admin,
        },
      });
    }
    if (path === "bucketlist" || path === "portfolio") {
      if (!current.premium) throw new ApiError(403, "Explorer+ is required.");
      const column = path === "portfolio" ? "visited_at" : "saved_at";
      const result = await current.db
        .from("member_places")
        .select(`place_id,saved_at,visited_at,places(${planningPlaceSelect})`)
        .eq("user_id", current.user.id)
        .not(column, "is", null)
        .order(column, { ascending: false })
        .range(0, 999);
      databaseError(result.error);
      return json({
        data: (result.data || []).map((row) => ({
          ...row,
          place: planningPlace(row.places),
        })),
      });
    }
    if (path === "memberships") {
      const result = await current.db
        .from("subscriptions")
        .select("*,membership_plans(*)")
        .eq("user_id", current.user.id)
        .order("created_at", { ascending: false });
      databaseError(result.error);
      return json({ data: result.data, premium: current.premium });
    }
    throw new ApiError(404, "Resource not found.");
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { resource } = await params;
    const path = resource.join("/");
    if (path === "contact") {
      const body = await input(
        request,
        z.object({
          name: z.string().trim().min(1).max(100),
          email: z.email().max(254),
          message: z.string().trim().min(1).max(10000),
          topic: z
            .enum(["Inquiry", "Partnership Proposal", "Other"])
            .optional(),
          website: z.string().max(0).optional(),
        }),
      );
      await rateLimit("contact", body.email.toLowerCase(), 3, 3600);
      const result = await privilegedSupabase()
        .from("contact_messages")
        .insert({
          name: body.name,
          email: body.email,
          message: body.topic
            ? `[${body.topic}]\n\n${body.message}`
            : body.message,
        });
      databaseError(result.error);
      return json({ message: "Your message has been received." }, 201);
    }
    const current = await requireSession(request);
    if (path === "bucketlist" || path === "portfolio") {
      const body = await input(
        request,
        z.object({
          place_id: uuid,
          op: z.enum(["save", "unsave", "visit", "unvisit"]),
        }),
      );
      const result = await current.db.rpc("set_member_place", {
        pid: body.place_id,
        op: body.op,
      });
      databaseError(result.error);
      return json({ data: result.data });
    }
    if (path === "reviews") {
      const body = await input(request, reviewInput);
      await rateLimit("review", current.user.id, 10, 600);
      const result = await current.db
        .from("reviews")
        .insert({
          ...body,
          user_id: current.user.id,
          author_name: "Explorer",
          body: safeHtml(body.body),
        })
        .select("id,status")
        .single();
      databaseError(result.error);
      return json({ data: result.data }, 201);
    }
    if (path === "review-likes") {
      const body = await input(
        request,
        z.object({ review_id: uuid, liked: z.boolean() }),
      );
      const result = body.liked
        ? await current.db
            .from("review_likes")
            .upsert(
              { review_id: body.review_id, user_id: current.user.id },
              { onConflict: "review_id,user_id", ignoreDuplicates: true },
            )
        : await current.db
            .from("review_likes")
            .delete()
            .eq("review_id", body.review_id)
            .eq("user_id", current.user.id);
      databaseError(result.error);
      return json({ liked: body.liked });
    }
    throw new ApiError(404, "Resource not found.");
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { resource } = await params;
    if (resource.join("/") !== "me")
      throw new ApiError(404, "Resource not found.");
    const current = await requireSession(request);
    const body = await input(request, profileInput);
    const result = await current.db
      .from("profiles")
      .update(body)
      .eq("id", current.user.id)
      .select("display_name,avatar_preset,featured_place_id")
      .single();
    databaseError(result.error);
    return json({ data: result.data, message: "Profile updated." });
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { resource } = await params;
    const current = await requireSession(request);
    if (resource[0] !== "reviews" || !resource[1])
      throw new ApiError(404, "Resource not found.");
    const result = await current.db
      .from("reviews")
      .delete()
      .eq("id", uuid.parse(resource[1]))
      .eq("user_id", current.user.id)
      .select("id");
    databaseError(result.error);
    if (!result.data?.length) throw new ApiError(404, "Review not found.");
    return json({ deleted: true });
  });
}
