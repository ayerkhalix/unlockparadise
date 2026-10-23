import { readFile } from "node:fs/promises";
import path from "node:path";
import { api, ApiError } from "@/lib/http";
import { backendConfigured } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { viewerTier } from "@/lib/destinations";
export async function GET(request: Request) {
  return api(async () => {
    const url = new URL(request.url);
    const requested = url.searchParams.get("path") || "";
    const routing = JSON.parse(
      await readFile(
        path.join(process.cwd(), "src/lib/generated/media-routing.json"),
        "utf8",
      ),
    ) as Record<
      string,
      { id: string; relative: string; mime_type: string; required_tier: string }
    >;
    const record = routing[requested];
    if (!record) throw new ApiError(404, "Image unavailable.");
    if (backendConfigured()) {
      const db = await serverSupabase(request);
      const result = await db
        .from("media")
        .select("id")
        .eq("id", record.id)
        .maybeSingle();
      if (result.error || !result.data)
        throw new ApiError(404, "Image unavailable.");
      return new Response(null, {
        status: 307,
        headers: {
          Location: `/api/media/${record.id}/`,
          "Cache-Control": "private,no-store",
        },
      });
    }
    // Retain the isolated Phase 1 development preview only. No production fallback.
    const tier = await viewerTier();
    if (
      process.env.NODE_ENV !== "development" ||
      tier === "public" ||
      record.required_tier === "private" ||
      (record.required_tier === "explorer-plus" && tier !== "explorer-plus")
    )
      throw new ApiError(404, "Image unavailable.");
    const base = path.resolve(
        process.cwd(),
        "artifacts/backend-private/local-media",
      ),
      file = path.resolve(base, record.relative);
    if (!file.startsWith(base + path.sep))
      throw new ApiError(404, "Image unavailable.");
    const bytes = await readFile(file);
    return new Response(bytes, {
      headers: {
        "Content-Type": record.mime_type,
        "Cache-Control": "private,no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
