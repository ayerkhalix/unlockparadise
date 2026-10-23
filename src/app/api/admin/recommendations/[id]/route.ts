import { z } from "zod";
import { api, databaseError, input, json, verifyOrigin } from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return api(async () => {
    const { db } = await requireStaff(request);
    const id = z.uuid().parse((await params).id);
    const result = await db
      .from("place_recommendations")
      .select(
        "recommended_place_id,recommendation_type,place:places!place_recommendations_recommended_place_id_fkey(id,title,slug,status)",
      )
      .eq("source_place_id", id)
      .order("position");
    databaseError(result.error);
    return json({
      data: (result.data || []).map((r) => ({
        place_id: r.recommended_place_id,
        type: r.recommendation_type || "",
        place: r.place,
      })),
    });
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { db } = await requireStaff(request);
    const id = z.uuid().parse((await params).id);
    const body = await input(
      request,
      z.object({
        items: z
          .array(
            z.object({
              place_id: z.uuid(),
              type: z.string().max(80).optional(),
            }),
          )
          .max(12),
      }),
    );
    const result = await db.rpc("save_recommendations", {
      source_id: id,
      items: body.items,
    });
    databaseError(result.error);
    return json({ saved: true });
  });
}
