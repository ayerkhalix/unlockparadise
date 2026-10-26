import { currentSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/http";
import { ItineraryWorkspace } from "@/components/itineraries";
import { ItineraryLibrary } from "@/components/itinerary-library";
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
  const query = await searchParams;
  if (!query.trip) return <ItineraryLibrary />;
  if (!z.uuid().safeParse(query.trip).success) notFound();
  let selected;
  try {
    selected = await getTrip(current.db, current.user.id, query.trip);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <ItineraryWorkspace key={selected.id} selected={selected} />;
}
