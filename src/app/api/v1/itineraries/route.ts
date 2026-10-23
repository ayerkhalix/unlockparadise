import { api, input, json, verifyOrigin, databaseError } from "@/lib/http";
import { requirePremium } from "@/lib/auth/session";
import { tripInput } from "@/lib/planning";
import { getTrip, planningError } from "@/lib/repositories/planning";
export async function GET(request: Request) {
  return api(async () => {
    const { db, user } = await requirePremium(request);
    const result = await db
      .from("itineraries")
      .select("*,itinerary_days(*)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    databaseError(result.error);
    return json({ data: result.data });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const { db, user } = await requirePremium(request);
    const body = await input(request, tripInput);
    const result = await db.rpc("plan_itinerary", {
      trip_id: null,
      expected_version: null,
      action: "create",
      payload: body,
    });
    planningError(result.error);
    return json({ data: await getTrip(db, user.id, result.data) }, 201);
  });
}
