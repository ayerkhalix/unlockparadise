import { api, json } from "@/lib/http";
import { requirePremium } from "@/lib/auth/session";
import { getItineraryLibrary } from "@/lib/repositories/itinerary-library";
import { libraryFilters } from "@/lib/itinerary-library";

export async function GET(request: Request) {
  return api(async () => {
    const { db, user } = await requirePremium(request);
    return json(
      await getItineraryLibrary(
        db,
        user.id,
        libraryFilters(Object.fromEntries(new URL(request.url).searchParams)),
      ),
    );
  });
}
