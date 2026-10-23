import { mediaAvailable } from "@/lib/media-availability";
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { cache } from "react";
import { backendConfigured } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { currentSession } from "@/lib/auth/session";
import { databaseError } from "@/lib/http";
import { safeHtml } from "@/lib/html";
import { publicTravelerBadges } from "@/lib/repositories/traveler";
import type { PublicTravelerBadge } from "@/lib/traveler";

export type Tier = "public" | "explorer" | "explorer-plus";
export interface Destination {
  id: number;
  uuid?: string;
  accessible?: boolean;
  cover?: string;
  areaName?: string;
  categoryName?: string;
  slug: string;
  title: string;
  area: string;
  category: string;
  requiredTier: "explorer" | "explorer-plus";
  travelTime: number | null;
  isMountain?: boolean;
  travel?: {
    boat_required: boolean;
    departure_port: string | null;
    road_minutes: number | null;
    boat_minutes: number | null;
    hike_minutes: number | null;
    travel_notes: string;
    transport_minutes: Record<string, number | null>;
  };
  additionalContent?: string;
  accessibility: string[];
  assets: string[];
  weekdayCrowd: string;
  weekendCrowd: string;
  introduction: string;
  gallery: string[];
  coordinates: number[] | null;
  accessPoints?: import("./access-points").AccessPoint[];
  date: string;
  featured: boolean;
  featureOrder: number;
  reviews: {
    id?: string;
    userId?: string | null;
    author: string;
    body: string;
    date: string;
    rating: number;
    title?: string;
    likes?: number;
    liked?: boolean;
    approved?: boolean;
    travelerIdentity?: PublicTravelerBadge;
  }[];
}

// Offline snapshots are permitted only when the backend mode explicitly allows them.
// Neither the export nor this repository may be imported by a client component.
const snapshot = cache(async (): Promise<Destination[]> =>
  JSON.parse(
    await readFile(
      join(process.cwd(), "src/data/destinations.private.json"),
      "utf8",
    ),
  ),
);
export const destinationRepository = {
  async getBySlug(slug: string): Promise<Destination | undefined> {
    if (backendConfigured()) {
      const db = await serverSupabase();
      const result = await db
        .from("places")
        .select(
          "*,place_details(*),place_areas(areas(slug,name)),place_categories(categories(slug,name)),place_media(kind,position,media(id,bucket,object_path,status)),reviews(id,user_id,author_name,rating,title,body,created_at,status)",
        )
        .eq(z.uuid().safeParse(slug).success ? "id" : "slug", slug)
        .maybeSingle();
      databaseError(result.error);
      if (!result.data) {
        const locked = await db.rpc("locked_place", { identifier: slug });
        databaseError(locked.error);
        if (!locked.data) return undefined;
        return {
          id: 0,
          uuid: locked.data.id,
          slug: locked.data.slug,
          title: "Explorer+ destination",
          accessible: false,
          requiredTier: "explorer-plus",
          area: "",
          category: "",
          travelTime: null,
          accessibility: [],
          assets: [],
          weekdayCrowd: "",
          weekendCrowd: "",
          introduction: "",
          gallery: [],
          coordinates: null,
          date: "",
          featured: false,
          featureOrder: 0,
          reviews: [],
        };
      }
      const p = result.data;
      const details = p.place_details;
      const likes = await db.rpc("review_like_counts", {
        review_ids: (p.reviews || []).map((r: { id: string }) => r.id),
      });
      databaseError(likes.error);
      const badges = await publicTravelerBadges(
        db,
        (p.reviews || []).map((r: { id: string }) => r.id),
      );
      const media = (p.place_media || []).sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position,
      );
      const gallery = media
        .filter(
          (m: { kind: string; media: { status: string } | null }) =>
            m.kind === "gallery" && mediaAvailable(m.media),
        )
        .map(
          (m: { media: { id: string } }) =>
            `/api/media/${m.media.id}/?variant=large`,
        );
      const cover = media.find(
        (m: { kind: string; media: { status: string } | null }) =>
          m.kind === "cover" && mediaAvailable(m.media),
      );
      return {
        id: p.legacy_id || 0,
        uuid: p.id,
        slug: p.slug,
        title: p.title,
        area: p.place_areas?.[0]?.areas?.slug || "",
        category: p.place_categories?.[0]?.categories?.slug || "",
        areaName: p.place_areas?.[0]?.areas?.name,
        categoryName: p.place_categories?.[0]?.categories?.name,
        requiredTier: p.vip_content ? "explorer-plus" : "explorer",
        accessible: Boolean(details),
        cover: cover
          ? `/api/media/${cover.media.id}/?variant=large`
          : undefined,
        travelTime: p.travel_minutes,
        isMountain: p.place_categories?.some(
          (c: { categories: { slug: string } }) =>
            c.categories.slug === "mountain-hikes",
        ),
        travel: details
          ? {
              boat_required: details.boat_required,
              departure_port: details.departure_port,
              road_minutes: details.road_minutes,
              boat_minutes: details.boat_minutes,
              hike_minutes: details.hike_minutes,
              travel_notes: details.travel_notes,
              transport_minutes: details.transport_minutes || {},
            }
          : undefined,
        additionalContent:
          details?.description &&
          details?.content &&
          safeHtml(details.description).trim() !==
            safeHtml(details.content).trim()
            ? safeHtml(details.content)
            : undefined,
        accessibility: p.accessibility,
        assets: p.assets,
        weekdayCrowd: details?.weekday_crowd || "",
        weekendCrowd: details?.weekend_crowd || "",
        introduction: safeHtml(details?.description || details?.content || ""),
        gallery: gallery.length
          ? gallery
          : cover
            ? [`/api/media/${cover.media.id}/?variant=large`]
            : [],
        coordinates:
          details?.longitude != null && details?.latitude != null
            ? [Number(details.longitude), Number(details.latitude)]
            : null,
        date: p.published_at || p.created_at,
        accessPoints: details?.access_points || [],
        featured: p.featured,
        featureOrder: p.feature_order,
        reviews: (p.reviews || []).map(
          (r: {
            id: string;
            user_id: string | null;
            author_name: string;
            body: string;
            created_at: string;
            rating: number;
            title: string;
            status: string;
          }) => ({
            id: r.id,
            userId: r.user_id,
            author: r.author_name,
            body: safeHtml(r.body),
            date: r.created_at,
            rating: r.rating,
            title: r.title,
            approved: r.status === "approved",
            travelerIdentity: badges.find((b) => b.review_id === r.id),
            likes:
              likes.data?.find(
                (l: { review_id: string }) => l.review_id === r.id,
              )?.likes || 0,
            liked:
              likes.data?.find(
                (l: { review_id: string }) => l.review_id === r.id,
              )?.liked || false,
          }),
        ),
      };
    }
    const data = await snapshot();
    const decoded = (value: string) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    return (data as Destination[]).find(
      (place) => place.slug === slug || decoded(place.slug) === decoded(slug),
    );
  },
  async getSlugs(): Promise<string[]> {
    if (!backendConfigured())
      return (await snapshot()).map((place) => place.slug);
    const result = await (
      await serverSupabase()
    )
      .from("places")
      .select("slug")
      .eq("status", "publish")
      .limit(1000);
    databaseError(result.error);
    return (result.data || []).map((p) => p.slug);
  },
};

export const viewerTier = cache(async (): Promise<Tier> => {
  if (backendConfigured()) {
    const current = await currentSession();
    return current?.premium ? "explorer-plus" : current ? "explorer" : "public";
  }
  // There is deliberately no cookie, query-string or browser-storage tier override.
  // Production never enables the development preview, even if the variable is set.
  if (process.env.NODE_ENV !== "development") return "public";
  const tier = process.env.PHASE1_PREVIEW_TIER;
  return tier === "explorer" || tier === "explorer-plus" ? tier : "public";
});

export function canView(place: Destination, tier: Tier): boolean {
  if (place.accessible !== undefined) return place.accessible;
  return (
    tier === "explorer-plus" ||
    (tier === "explorer" && place.requiredTier === "explorer")
  );
}
