import { z } from "zod";
import { safeLibraryReturn } from "./itinerary-library";
import type { AccessPoint } from "./access-points";

export function tripDuration(start: string, end: string) {
  if (!start || !end) return null;
  const days =
    Math.round(
      (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) /
        86400000,
    ) + 1;
  return Number.isFinite(days) && days >= 1 && days <= 60 ? days : null;
}

export const tripInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    notes: z.string().max(5000).default(""),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
    day_count: z.number().int().min(1).max(60),
    area_id: z.uuid().optional(),
  })
  .refine(
    (v) =>
      (!v.start_date && !v.end_date) ||
      (v.start_date &&
        v.end_date &&
        v.end_date >= v.start_date &&
        Date.parse(v.end_date) - Date.parse(v.start_date) < 60 * 86400000),
    {
      message: "Choose both dates, with a trip of 1 to 60 days.",
      path: ["end_date"],
    },
  );
export const newTripInput = tripInput.and(z.object({ area_id: z.uuid() }));
const id = z.string().uuid();
const localTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.")
  .nullable()
  .optional();
export const stopTimeInput = z
  .object({ start_time: localTime, end_time: localTime })
  .refine(
    (v) =>
      (!v.start_time && !v.end_time) ||
      Boolean(v.start_time && v.end_time && v.end_time > v.start_time),
    {
      message:
        "Choose both times, with the end after the start on the same day.",
      path: ["end_time"],
    },
  );
export type StopTime = { start_time: string | null; end_time: string | null };
export function stopTimeLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return "Time not set";
  const minutes = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const label = (value: string) => {
    const h = Number(value.slice(0, 2));
    return `${h % 12 || 12}:${value.slice(3, 5)} ${h >= 12 ? "PM" : "AM"}`;
  };
  const duration = minutes(end) - minutes(start);
  const length = [
    Math.floor(duration / 60) ? `${Math.floor(duration / 60)}h` : "",
    duration % 60 ? `${duration % 60}m` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `${label(start)} – ${label(end)} · ${length}`;
}
export const planMutation = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("update"), payload: tripInput }),
    z.object({ action: z.literal("add_day"), payload: z.object({}) }),
    z.object({
      action: z.literal("save_changes"),
      payload: z.object({
        items: z
          .array(
            z
              .object({ item_id: id, notes: z.string().max(2000) })
              .and(stopTimeInput),
          )
          .min(1)
          .max(50),
      }),
    }),
    z.object({
      action: z.literal("delete_day"),
      payload: z.object({ day_id: id }),
    }),
    z.object({
      action: z.literal("add"),
      payload: z.object({ day_id: id, place_id: id }).and(stopTimeInput),
    }),
    z.object({
      action: z.literal("schedule"),
      payload: z.object({ item_id: id }).and(stopTimeInput),
    }),
    z.object({
      action: z.literal("remove"),
      payload: z.object({ item_id: id }),
    }),
    z.object({
      action: z.literal("restore"),
      payload: z
        .object({
          day_id: id,
          place_id: id,
          position: z.number().int().min(0).max(49),
          notes: z.string().max(2000),
        })
        .and(stopTimeInput),
    }),
    z.object({
      action: z.literal("move"),
      payload: z.object({ item_id: id, day_id: id }),
    }),
    z.object({
      action: z.literal("notes"),
      payload: z.object({ item_id: id, notes: z.string().max(2000) }),
    }),
    z.object({
      action: z.literal("reorder"),
      payload: z.object({ day_id: id, item_ids: z.array(id).max(50) }),
    }),
  ])
  .and(z.object({ version: z.number().int().min(1) }));

export type TravelPlace = {
  areaIds?: string[];
  accessibility?: string[];
  assets?: string[];
  vip?: boolean;
  publishedAt?: string;
  rating?: number | null;
  travelMinutes?: number | null;
  id: string;
  slug: string;
  title: string;
  area: string;
  category: string;
  image: string | null;
  images?: string[];
  coordinates: [number, number] | null;
  accessPoints?: AccessPoint[];
};
export type TripDay = { id: string; itinerary_id: string; day_number: number };
export type TripItem = {
  id: string;
  day_id: string;
  itinerary_id: string;
  place_id: string;
  position: number;
  notes: string;
  start_time?: string | null;
  end_time?: string | null;
  place: TravelPlace | null;
};
export type Trip = {
  id: string;
  area_id?: string | null;
  areas?: { id: string; name: string; slug: string } | null;
  title: string;
  notes: string;
  start_date: string | null;
  end_date: string | null;
  version: number;
  updated_at: string;
  itinerary_days: TripDay[];
  items: TripItem[];
};
export type SavedPlace = TravelPlace & { saved_at: string; visited: boolean };

export function plannerHref(
  tripId?: string,
  dayId?: string,
  libraryReturn?: string | null,
) {
  const query = new URLSearchParams();
  if (tripId) query.set("trip", tripId);
  if (dayId) query.set("day", dayId);
  const target = safeLibraryReturn(libraryReturn);
  if (target) query.set("return_to", target);
  return `/itineraries/${query.size ? `?${query}` : ""}`;
}

export function tripDateLabel(start: string | null, end: string | null) {
  if (!start || !end) return "Dates are flexible";
  // ICU versions use different spaces around range separators. Normalize them
  // so the server and browser produce identical text during hydration.
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
    .formatRange(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`))
    .replace(/\s+/gu, " ");
}

export function dayLabel(day: TripDay, start: string | null) {
  if (!start) return `Day ${day.day_number}`;
  const date = new Date(start + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + day.day_number - 1);
  return `Day ${day.day_number} · ${date.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}
