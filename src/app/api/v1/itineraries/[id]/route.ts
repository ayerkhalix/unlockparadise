import { z } from "zod";
import { api, input, json, verifyOrigin } from "@/lib/http";
import { requirePremium } from "@/lib/auth/session";
import { planMutation } from "@/lib/planning";
import { getTrip, planningError } from "@/lib/repositories/planning";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return api(async () => {
    const { db, user } = await requirePremium(request);
    return json({
      data: await getTrip(db, user.id, z.uuid().parse((await params).id)),
    });
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { db, user } = await requirePremium(request);
    const id = z.uuid().parse((await params).id);
    const body = await input(request, planMutation);
    const result = await db.rpc("plan_itinerary", {
      trip_id: id,
      expected_version: body.version,
      action: body.action,
      payload: body.payload,
    });
    planningError(result.error);
    return json({ data: await getTrip(db, user.id, id) });
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { db } = await requirePremium(request);
    const id = z.uuid().parse((await params).id);
    const body = await input(
      request,
      z.object({ version: z.number().int().min(1) }),
    );
    const result = await db.rpc("plan_itinerary", {
      trip_id: id,
      expected_version: body.version,
      action: "delete",
      payload: {},
    });
    planningError(result.error);
    return json({ deleted: true });
  });
}
