import {
  api,
  ApiError,
  databaseError,
  json,
  verifyOrigin,
  uploadForm,
} from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
import { validatedImage } from "@/lib/storage/images";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireStaff(request);
    await rateLimit("admin-upload", current.user.id, 12, 600);
    if (Number(request.headers.get("content-length") || 0) > 6 * 1024 * 1024)
      throw new ApiError(413, "Use an image up to 5 MB.");
    const form = await uploadForm(request, 6 * 1024 * 1024),
      file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose an image.");
    if (file.size > 5 * 1024 * 1024)
      throw new ApiError(413, "Use an image up to 5 MB.");
    const bucket =
      form.get("visibility") === "public"
        ? "destination-public"
        : "destination-private";
    const image = await validatedImage(file);
    const path = "admin/" + image.name;
    const upload = await current.db.storage
      .from(bucket)
      .upload(path, image.data, { contentType: image.mime, upsert: false });
    if (upload.error) throw new ApiError(503, "Upload failed.");
    const result = await current.db
      .from("media")
      .insert({
        bucket,
        object_path: path,
        mime_type: image.mime,
        byte_size: image.data.length,
        checksum: image.checksum,
        width: image.width,
        height: image.height,
        alt: String(form.get("alt") || "").slice(0, 1000),
        status: "ready",
      })
      .select("id")
      .single();
    if (result.error) {
      await current.db.storage.from(bucket).remove([path]);
      databaseError(result.error);
    }
    return json({ data: result.data }, 201);
  });
}
