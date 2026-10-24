import { z } from "zod";
import { accessPointInput } from "./access-points";
import { nearbyPlacesInput } from "./nearby-places";
import { archetypes } from "./traveler";
export const uuid = z.string().uuid();
export const placeInput = z
  .object({
    title: z.string().trim().min(1).max(300),
    slug: z
      .string()
      .min(1)
      .max(240)
      .regex(/^[a-z0-9%_-]+$/),
    status: z.enum(["draft", "publish", "archived"]),
    vip_content: z.boolean(),
    premium_content: z.boolean(),
    listing_types: z.array(z.enum(["destination", "lot"])).min(1),
    travel_minutes: z.number().min(0).max(100000).nullable(),
    journey_start: z.string().trim().min(1).max(200).optional(),
    boat_required: z.boolean().optional(),
    departure_port: z.string().trim().max(200).nullable().optional(),
    road_minutes: z.number().min(0).max(100000).nullable().optional(),
    boat_minutes: z.number().min(0).max(100000).nullable().optional(),
    hike_minutes: z.number().min(0).max(100000).nullable().optional(),
    travel_notes: z.string().max(5000).optional(),
    transport_minutes: z
      .object({
        Motorcycle: z.number().min(0).max(100000).nullable().optional(),
        Car: z.number().min(0).max(100000).nullable().optional(),
        "4x4": z.number().min(0).max(100000).nullable().optional(),
        Boat: z.number().min(0).max(100000).nullable().optional(),
      })
      .strict()
      .optional(),
    accessibility: z.array(
      z.enum(["Motorcycle", "Car", "4x4", "Boat", "Hike"]),
    ),
    assets: z.array(
      z.enum([
        "Sunrise view",
        "Sunset view",
        "Surfing spot",
        "Accommodation available",
        "Culture",
        "Activities",
        "Food",
      ]),
    ),
    featured: z.boolean(),
    feature_order: z.number().int(),
    description: z.string().max(100000),
    content: z.string().max(300000).default(""),
    excerpt: z.string().max(10000).default(""),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    access_points: z.array(accessPointInput).max(12).optional(),
    traveler_types: z
      .array(
        z
          .string()
          .refine(
            (v) => v !== "curious-explorer" && Object.hasOwn(archetypes, v),
            "Choose an explorer identity from the list.",
          ),
      )
      .max(63)
      .refine(
        (v) => new Set(v).size === v.length,
        "Choose each traveler type once.",
      )
      .optional(),
    nearby_places: nearbyPlacesInput.optional(),
    weekday_crowd: z.enum(["", "Crowded", "Uncrowded"]),
    weekend_crowd: z.enum(["", "Crowded", "Uncrowded"]),
    area_ids: z.array(uuid),
    category_ids: z.array(uuid),
    gallery: z.array(uuid).max(8),
    cover_id: uuid.nullable(),
    expected_updated_at: z.iso.datetime({ offset: true }).optional(),
    seo: z
      .object({
        title: z.string().max(160),
        description: z.string().max(320),
        canonical: z
          .string()
          .max(500)
          .refine(
            (v) =>
              !v || (/^https:\/\//.test(v) && z.url().safeParse(v).success),
            "Use an HTTPS URL.",
          ),
      })
      .optional(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: "Supply both latitude and longitude.",
  });
export const reviewInput = z
  .object({
    place_id: uuid,
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(80).default(""),
    body: z.string().trim().max(10000).default(""),
  })
  .strict();
export const profileInput = z
  .object({
    display_name: z.string().trim().min(2).max(40).optional(),
    avatar_preset: z
      .enum([
        "palm",
        "boat",
        "island",
        "shell",
        "sunset",
        "surfer",
        "turtle",
        "wave",
      ])
      .optional(),
    featured_place_id: uuid.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Supply a profile field.",
  });
