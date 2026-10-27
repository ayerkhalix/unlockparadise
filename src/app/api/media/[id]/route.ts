import { z } from "zod";
import { api, ApiError, databaseError } from "@/lib/http";
import { serverSupabase } from "@/lib/supabase/server";
import { legacyImage } from "@/lib/storage/legacy";
import { mediaAvailable } from "@/lib/media-availability";
import { imageWidths } from "@/lib/image-delivery";
import { storedImage } from "@/lib/storage/variants";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    z.string().uuid().parse(id);
    const db = await serverSupabase(request);
    const result = await db
      .from("media")
      .select(
        "bucket,object_path,status,original_path,mime_type,checksum,width,height",
      )
      .eq("id", id)
      .maybeSingle();
    databaseError(result.error);
    if (!result.data) throw new ApiError(404, "Image unavailable.");
    if (!mediaAvailable(result.data))
      throw new ApiError(404, "Image unavailable.");
    const variant = new URL(request.url).searchParams.get("variant");
    if (variant) {
      z.string()
        .regex(/^[a-z0-9_-]{1,40}$/)
        .parse(variant);
    }
    if (result.data.status === "legacy") return legacyImage(result.data);
    if (result.data.status !== "ready")
      throw new ApiError(404, "Image unavailable.");
    const width = Number(new URL(request.url).searchParams.get("width"));
    const files = await db
      .from("media_files")
      .select(
        "bucket,object_path,status,original_path,mime_type,checksum,width,height,variant",
      )
      .eq("media_id", id)
      .eq("bucket", result.data.bucket)
      .eq("status", "ready")
      .limit(40);
    databaseError(files.error);
    const file =
      process.env.MEDIA_STORED_VARIANTS === "off"
        ? result.data
        : storedImage(
            result.data,
            files.data || [],
            imageWidths.includes(width as (typeof imageWidths)[number])
              ? width
              : undefined,
            variant,
          );
    if (result.data.bucket === "destination-public") {
      const { data } = db.storage
        .from(file.bucket)
        .getPublicUrl(file.object_path);
      return new Response(null, {
        status: 307,
        headers: {
          Location: data.publicUrl,
          "Cache-Control": "public,max-age=300",
        },
      });
    }
    const { data, error } = await db.storage
      .from(file.bucket)
      .createSignedUrl(file.object_path, 60);
    if (error || !data) throw new ApiError(503, "Image unavailable.");
    return new Response(null, {
      status: 307,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "private,no-store",
        Vary: "Cookie, Authorization",
      },
    });
  });
}
