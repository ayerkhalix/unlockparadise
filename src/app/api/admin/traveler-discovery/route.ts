import { api, databaseError, json } from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
export async function GET(request: Request) {
  return api(async () => {
    const current = await requireStaff(request, true);
    const result = await current.db.rpc("traveler_discovery_stats");
    databaseError(result.error);
    return json({ data: result.data });
  });
}
