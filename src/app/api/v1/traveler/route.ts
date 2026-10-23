import { api, databaseError, input, json, verifyOrigin } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { travelPreferences } from "@/lib/repositories/traveler";
import { travelerWriteSchema } from "@/lib/traveler";
export async function GET(request: Request) {
  return api(async () => {
    const current = await requireSession(request);
    return json({ data: await travelPreferences(current.db, current.user.id) });
  });
}
export async function PUT(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireSession(request);
    const body = await input(request, travelerWriteSchema, 8192);
    const result = await current.db.rpc("save_traveler_preferences", {
      body,
      expected_version: body.version,
    });
    databaseError(result.error);
    return json({ data: result.data });
  });
}
