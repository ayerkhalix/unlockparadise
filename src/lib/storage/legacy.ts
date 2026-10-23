import "server-only";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { legacyPublicUrl } from "@/lib/media-availability";
import { ApiError } from "@/lib/http";

export async function legacyImage(media: { bucket: string; original_path: string | null; mime_type: string; checksum: string | null }) {
  if (!media.original_path) throw new ApiError(404, "Image unavailable.");
  // Validate the relative path even when serving the local development copy.
  legacyPublicUrl("https://legacy.invalid/", media.original_path);
  if (media.bucket === "destination-public") {
    const base = process.env.LEGACY_PUBLIC_MEDIA_BASE_URL;
    if (!base) throw new ApiError(503, "Legacy public media is not configured.");
    return new Response(null, { status: 307, headers: {
      Location: legacyPublicUrl(base, media.original_path),
      "Cache-Control": "public,max-age=300",
    } });
  }
  // Caller must first SELECT this row with the user's session and RLS.
  // Never redirect private images to the public WordPress media origin.
  if (process.env.LEGACY_PRIVATE_MEDIA_MODE === "local" && process.env.NODE_ENV === "development" && process.env.UPD_ENVIRONMENT === "staging" && process.env.LEGACY_PRIVATE_MEDIA_ROOT) {
    const root = await realpath(process.env.LEGACY_PRIVATE_MEDIA_ROOT);
    const file = await realpath(path.resolve(root, media.original_path));
    if (!file.startsWith(root + path.sep)) throw new ApiError(404, "Image unavailable.");
    const bytes = await readFile(file);
    if (!media.checksum || createHash("sha256").update(bytes).digest("hex") !== media.checksum)
      throw new ApiError(503, "Image verification failed.");
    return new Response(bytes, { headers: {
      "Content-Type": media.mime_type, "Cache-Control": "private,no-store",
      Vary: "Cookie, Authorization", "X-Content-Type-Options": "nosniff",
    } });
  }
  // Deployed staging works without a local filesystem or a private media origin.
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#edf5f3"/><text x="400" y="300" text-anchor="middle" fill="#185f55" font-family="sans-serif" font-size="20">Photo unavailable</text></svg>', { headers: {
    "Content-Type": "image/svg+xml", "Cache-Control": "private,no-store", Vary: "Cookie, Authorization", "X-Content-Type-Options": "nosniff",
  } });
}
