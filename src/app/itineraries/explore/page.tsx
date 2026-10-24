import { currentSession } from "@/lib/auth/session";
import { getTrip } from "@/lib/repositories/planning";
import { PlannerBrowser } from "@/components/planner-browser";
import { ApiError } from "@/lib/http";
import { z } from "zod";
export const metadata = { title: "Add destinations" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string; day?: string }>;
}) {
  const current = await currentSession();
  if (!current?.premium) return null;
  const query = await searchParams;
  let selected;
  if (z.uuid().safeParse(query.trip).success) {
    try {
      selected = await getTrip(current.db, current.user.id, query.trip!);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }
  if (selected) {
    if (!selected.area_id)
      return (
        <section className="p2-empty">
          <h1>Choose your trip area first</h1>
          <p>
            Open Edit trip and choose one area. Your existing stops will stay
            saved.
          </p>
          <a className="p2-button" href={`/itineraries/?trip=${selected.id}`}>
            Back to your trip
          </a>
        </section>
      );
    const day =
      selected.itinerary_days.find((day) => day.id === query.day) ||
      selected.itinerary_days[0];
    return <PlannerBrowser initial={selected} dayId={day.id} />;
  }
  return (
    <section className="p2-empty">
      <h1>Choose a trip to add destinations</h1>
      <p>This trip is unavailable, or a trip has not been selected.</p>
      <a className="p2-button" href="/itineraries/">
        Back to your plans
      </a>
    </section>
  );
}
