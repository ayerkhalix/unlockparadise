import { z } from "zod";

export const itineraryLibraryPageSize = 12;
const libraryQuery = z.object({
  q: z.string().trim().max(120).catch(""),
  area: z.union([z.uuid(), z.literal("unassigned"), z.literal("")]).catch(""),
  sort: z.enum(["recent", "date", "name"]).catch("recent"),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
});
export type LibraryFilters = z.infer<typeof libraryQuery>;
export function libraryFilters(query: Record<string, unknown>): LibraryFilters {
  return libraryQuery.parse(query);
}
export function libraryHref(filters: LibraryFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.area) query.set("area", filters.area);
  if (filters.sort !== "recent") query.set("sort", filters.sort);
  if (filters.page !== 1) query.set("page", String(filters.page));
  return `/itineraries/${query.size ? `?${query}` : ""}`;
}
/** Only the itinerary library may be the editor's return destination. */
export function safeLibraryReturn(
  value: string | null | undefined,
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://library.invalid");
    if (
      url.origin !== "https://library.invalid" ||
      !/^\/itineraries\/?$/.test(url.pathname) ||
      url.searchParams.has("trip") ||
      url.searchParams.has("create")
    )
      return null;
    return libraryHref(libraryFilters(Object.fromEntries(url.searchParams)));
  } catch {
    return null;
  }
}
export type ItinerarySummary = {
  id: string;
  title: string;
  area_id: string | null;
  area: string;
  start_date: string | null;
  end_date: string | null;
  day_count: number;
  stop_count: number;
  image: string | null;
};
export type ItineraryLibraryResult = {
  data: ItinerarySummary[];
  areas: { id: string; name: string }[];
  count: number;
  total: number;
  page: number;
  pages: number;
  pageSize: number;
};
