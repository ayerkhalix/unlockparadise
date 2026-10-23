import { currentSession } from "@/lib/auth/session";
import { databaseError, ApiError } from "@/lib/http";
import { ItineraryWorkspace } from "@/components/itineraries";
import { getTrip } from "@/lib/repositories/planning";
import { notFound } from "next/navigation";
import { z } from "zod";
export const metadata = { title: "Itinerary Planner" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string; day?: string; create?: string }>;
}) {
  const current = await currentSession();
  if (!current?.premium) return null;
  const result = await current.db
    .from("itineraries")
    .select("*,itinerary_days(*)")
    .eq("user_id", current.user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  databaseError(result.error);
  const query = await searchParams;
  if (query.trip && !z.uuid().safeParse(query.trip).success) notFound();
  const selectedId = query.trip || result.data?.[0]?.id;
  let selected;
  if (selectedId) {
    try {
      selected = await getTrip(current.db, current.user.id, selectedId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }
  return (
    <ItineraryWorkspace
      key={`${selectedId || "first-trip"}:${query.create === "1" ? "create" : "plan"}`}
      initial={(result.data || []).map((t) => ({ ...t, items: [] }))}
      selected={selected}
      create={query.create === "1"}
    />
  );
}
