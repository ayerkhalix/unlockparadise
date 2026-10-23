import {
  api,
  ApiError,
  databaseError,
  json,
  verifyOrigin,
  uploadForm,
} from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { privilegedSupabase } from "@/lib/supabase/server";
import { validatedImage } from "@/lib/storage/images";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireSession(request);
    await rateLimit("photo", current.user.id, 10, 3600);
    if (Number(request.headers.get("content-length") || 0) > 9 * 1024 * 1024)
      throw new ApiError(413, "Use an image up to 8 MB.");
    const form = await uploadForm(request, 9 * 1024 * 1024);
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a photo.");
    const image = await validatedImage(file, { avatar: true });
    const service = privilegedSupabase();
    const path = current.user.id + "/" + image.name;
    const uploaded = await service.storage
      .from("profile-private")
      .upload(path, image.data, { contentType: image.mime, upsert: false });
    if (uploaded.error)
      throw new ApiError(503, "The photo could not be uploaded.");
    const setting = await current.db
      .from("app_settings")
      .select("value")
      .eq("key", "avatar_moderation")
      .single();
    databaseError(setting.error);
    const status = setting.data?.value === "hold" ? "pending" : "ready";
    const row = await service
      .from("media")
      .insert({
        owner_id: current.user.id,
        bucket: "profile-private",
        object_path: path,
        mime_type: image.mime,
        byte_size: image.data.length,
        checksum: image.checksum,
        width: 192,
        height: 192,
        status,
      })
      .select("id")
      .single();
    if (row.error) {
      await service.storage.from("profile-private").remove([path]);
      databaseError(row.error);
    }
    const previous = await service
      .from("profile_media")
      .select("media_id")
      .eq("user_id", current.user.id)
      .maybeSingle();
    databaseError(previous.error);
    const association = await service.from("profile_media").upsert({
      user_id: current.user.id,
      media_id:
        status === "pending" ? previous.data?.media_id || null : row.data!.id,
      pending_media_id: status === "pending" ? row.data!.id : null,
    });
    databaseError(association.error);
    return json(
      {
        message:
          status === "pending"
            ? "Photo uploaded. It will appear once approved."
            : "Photo uploaded.",
      },
      201,
    );
  });
}
export async function DELETE(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireSession(request);
    const result = await privilegedSupabase()
      .from("profile_media")
      .delete()
      .eq("user_id", current.user.id);
    databaseError(result.error);
    return json({ message: "Photo removed." });
  });
}
