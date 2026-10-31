import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, databaseError } from "@/lib/http";

/** Public avatars expose only a current approved picture; storage stays private. */
export async function publicAvatar(
  request: Request,
  id: string,
  service: SupabaseClient,
) {
  const result = await service
    .from("profile_media")
    .select(
      "media!profile_media_media_id_fkey(bucket,object_path,mime_type,status,checksum)",
    )
    .eq("media_id", id)
    .maybeSingle();
  databaseError(result.error);
  const photo = result.data?.media as unknown as {
    bucket: string;
    object_path: string;
    mime_type: string;
    status: string;
    checksum: string;
  } | null;
  if (
    !photo ||
    photo.status !== "ready" ||
    photo.bucket !== "profile-private" ||
    !["image/webp", "image/jpeg", "image/png"].includes(photo.mime_type)
  )
    throw new ApiError(404, "Profile photo unavailable.");
  const tag = `"${photo.checksum}"`;
  const headers = {
    "Content-Type": photo.mime_type,
    "Cache-Control": "public, max-age=60, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ETag: tag,
  };
  if (request.headers.get("if-none-match") === tag)
    return new Response(null, { status: 304, headers });
  const file = await service.storage
    .from(photo.bucket)
    .download(photo.object_path);
  if (file.error || !file.data)
    throw new ApiError(503, "Profile photo unavailable.");
  return new Response(file.data, { headers });
}
