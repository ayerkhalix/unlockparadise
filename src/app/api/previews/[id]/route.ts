import sharp from "sharp";
import { z } from "zod";
import { api, ApiError, databaseError } from "@/lib/http";
import { privilegedSupabase } from "@/lib/supabase/server";

/** Public, deliberately limited cover preview. Never redirect to a private object or disclose its path. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    z.uuid().parse(id);
    const db = privilegedSupabase();
    const place = await db
      .from("places")
      .select("id")
      .eq("id", id)
      .eq("status", "publish")
      .contains("listing_types", ["destination"])
      .maybeSingle();
    databaseError(place.error);
    if (!place.data) throw new ApiError(404, "Preview unavailable.");
    const cover = await db
      .from("place_media")
      .select("media_id")
      .eq("place_id", id)
      .eq("kind", "cover")
      .order("position")
      .limit(1)
      .maybeSingle();
    databaseError(cover.error);
    if (!cover.data) throw new ApiError(404, "Preview unavailable.");
    const media = await db
      .from("media")
      .select("bucket,object_path,status")
      .eq("id", cover.data.media_id)
      .eq("status", "ready")
      .maybeSingle();
    databaseError(media.error);
    if (
      !media.data ||
      !["destination-public", "destination-private"].includes(media.data.bucket)
    )
      throw new ApiError(404, "Preview unavailable.");
    const variant = await db
      .from("media_files")
      .select("bucket,object_path")
      .eq("media_id", cover.data.media_id)
      .eq("variant", "medium_large")
      .eq("status", "ready")
      .in("bucket", ["destination-public", "destination-private"])
      .maybeSingle();
    const file = variant.data || media.data;
    const download = await db.storage
      .from(file.bucket)
      .download(file.object_path);
    if (
      download.error ||
      !download.data ||
      download.data.size > 20 * 1024 * 1024
    )
      throw new ApiError(404, "Preview unavailable.");
    const image = await sharp(Buffer.from(await download.data.arrayBuffer()), {
      limitInputPixels: 60000000,
    })
      .rotate()
      .resize(640, 480, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public,max-age=300,s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
