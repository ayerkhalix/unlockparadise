import { z } from "zod";
import {
  api,
  ApiError,
  databaseError,
  input,
  json,
  verifyOrigin,
} from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { collectionTaglineInput, slugFromName } from "@/lib/catalog-options";
export async function GET(request: Request) {
  return api(async () => {
    const { db } = await requireStaff(request, true);
    const results = await Promise.all([
      db.from("merch_brands").select("id,name").order("name"),
      db
        .from("merch_collections")
        .select("id,brand_id,name,tagline")
        .order("name"),
      db.from("merch_options").select("kind,name").order("name"),
    ]);
    results.forEach((r) => databaseError(r.error));
    return json({
      brands: results[0].data,
      collections: results[1].data,
      options: results[2].data,
    });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const { db, user } = await requireStaff(request, true);
    await rateLimit("catalog-option", user.id, 60, 600);
    const body = await input(
      request,
      z
        .object({
          kind: z.enum(["brand", "collection", "category", "color", "size"]),
          name: z.string().trim().min(1).max(80),
          brand_id: z.string().uuid().optional(),
          tagline: collectionTaglineInput.optional(),
        })
        .strict(),
    );
    const slug = slugFromName(body.name);
    if (!slug)
      throw new ApiError(400, "Use a name with at least one letter or number.");
    if (body.kind === "collection" && !body.brand_id)
      throw new ApiError(400, "Choose a brand first.");
    const table =
      body.kind === "brand"
        ? "merch_brands"
        : body.kind === "collection"
          ? "merch_collections"
          : "merch_options";
    const row: Record<string, unknown> =
      body.kind === "brand"
        ? { name: body.name, slug }
        : body.kind === "collection"
          ? {
              name: body.name,
              slug,
              brand_id: body.brand_id,
              tagline: body.tagline || "",
            }
          : { kind: body.kind, name: body.name };
    const result = await db.from(table).insert(row).select("*").single();
    databaseError(result.error);
    return json({ data: result.data }, 201);
  });
}
export async function PATCH(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const { db, user } = await requireStaff(request, true);
    await rateLimit("catalog-option", user.id, 60, 600);
    const body = await input(
      request,
      z
        .object({
          id: z.string().uuid(),
          tagline: collectionTaglineInput,
          expected_tagline: z.string().max(160),
        })
        .strict(),
    );
    const result = await db
      .from("merch_collections")
      .update({ tagline: body.tagline })
      .eq("id", body.id)
      .eq("tagline", body.expected_tagline)
      .select("id,brand_id,name,tagline")
      .maybeSingle();
    databaseError(result.error);
    if (!result.data)
      throw new ApiError(
        409,
        "This collection changed. Close and reopen the product editor, then try again.",
      );
    return json({ data: result.data });
  });
}
