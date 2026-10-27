import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
import { api, ApiError, databaseError } from "@/lib/http";
import { privilegedSupabase } from "@/lib/supabase/server";
import { associationFocalPoint, focalCoverRegion } from "@/lib/focal-point";

/** Public, deliberately limited cover preview. Never redirect to a private object or disclose its path. */
export async function GET(
  request: Request,
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
      .select("media_id,focal_x,focal_y")
      .eq("place_id", id)
      .eq("kind", "cover")
      .order("position")
      .limit(1)
      .maybeSingle();
    databaseError(cover.error);
    if (!cover.data) throw new ApiError(404, "Preview unavailable.");
    const media = await db
      .from("media")
      .select("bucket,object_path,status,checksum")
      .eq("id", cover.data.media_id)
      .eq("status", "ready")
      .maybeSingle();
    databaseError(media.error);
    if (
      !media.data ||
      !["destination-public", "destination-private"].includes(media.data.bucket)
    )
      throw new ApiError(404, "Preview unavailable.");
    const focus = associationFocalPoint(cover.data);
    const signature = createHash("sha256")
      .update(
        JSON.stringify([
          "preview-v2",
          cover.data.media_id,
          media.data.checksum,
          focus.x,
          focus.y,
        ]),
      )
      .digest("hex");
    const previewPath = `previews/${signature}.webp`;
    const headers = {
      "Content-Type": "image/webp",
      "Cache-Control": "private,max-age=0,must-revalidate",
      ETag: `"${signature}"`,
      "X-Content-Type-Options": "nosniff",
    };
    // Publication and current cover were checked before allowing a conditional hit.
    if (request.headers.get("if-none-match") === headers.ETag)
      return new Response(null, { status: 304, headers });
    const stored = await db.storage
      .from("destination-public")
      .download(previewPath);
    if (!stored.error && stored.data)
      return new Response(await stored.data.arrayBuffer(), { headers });
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
    const source = sharp(Buffer.from(await download.data.arrayBuffer()), {
      limitInputPixels: 60000000,
    });
    const metadata = await source.metadata();
    const rotated = metadata.orientation != null && metadata.orientation >= 5;
    const width = (rotated ? metadata.height : metadata.width) || 1,
      height = (rotated ? metadata.width : metadata.height) || 1;
    let pipeline = source.rotate();
    if (focus.x !== 50 || focus.y !== 50)
      pipeline = pipeline.extract(focalCoverRegion(width, height, focus));
    const image = await pipeline
      .resize(640, 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    const saved = await db.storage
      .from("destination-public")
      .upload(previewPath, image, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (
      saved.error &&
      !["400", "409"].includes(
        String((saved.error as { statusCode?: string }).statusCode),
      )
    ) {
      // Keep the usable preview if Storage is temporarily unable to persist it.
      headers["Cache-Control"] = "private,no-store";
    }
    return new Response(new Uint8Array(image), {
      headers,
    });
  });
}
