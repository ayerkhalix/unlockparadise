import "server-only";
import { randomUUID } from "node:crypto";
import { privilegedSupabase } from "@/lib/supabase/server";
import { ApiError, databaseError } from "@/lib/http";
import { imageDerivatives } from "./derivatives";

/** Awaited bounded work, with a durable lease and an atomic metadata publication. */
export async function finishAdminUpload(id: string, owner: string) {
  const db = privilegedSupabase();
  const result = await db
    .from("media_upload_jobs")
    .select("*")
    .eq("id", id)
    .eq("owner_id", owner)
    .maybeSingle();
  databaseError(result.error);
  const job = result.data;
  if (!job) throw new ApiError(404, "Upload not found.");
  if (job.state === "ready") return { id: job.media_id, state: "ready" };
  if (
    job.state === "processing" &&
    Date.now() - Date.parse(job.updated_at) < 180000
  )
    return { state: "processing" };
  const lease = randomUUID();
  const claim = await db
    .from("media_upload_jobs")
    .update({
      state: "processing",
      lease,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("updated_at", job.updated_at)
    .select("id")
    .maybeSingle();
  databaseError(claim.error);
  if (!claim.data) return { state: "processing" };
  try {
    const source = await db.storage
      .from("media-archive")
      .download(job.source_path);
    if (source.error || !source.data)
      throw new ApiError(
        409,
        "The original has not finished uploading. Retry this upload.",
      );
    if (source.data.size !== job.source_bytes)
      throw new ApiError(400, "The uploaded file size does not match.");
    const input = Buffer.from(await source.data.arrayBuffer());
    const image = await imageDerivatives(input, job.source_mime);
    if (image.sourceChecksum !== job.source_checksum)
      throw new ApiError(400, "The uploaded original failed verification.");
    const files = [];
    for (const file of image.files) {
      const object_path = `optimized/${id}/${file.variant}.webp`;
      const upload = await db.storage
        .from(job.bucket)
        .upload(object_path, file.data, {
          contentType: file.mime_type,
          cacheControl: job.bucket === "destination-public" ? "31536000" : "60",
          upsert: false,
        });
      if (upload.error) {
        // A previous attempt may have stored this exact immutable derivative.
        const existing = await db.storage
          .from(job.bucket)
          .download(object_path);
        if (existing.error || !existing.data)
          throw new ApiError(
            503,
            "Image processing could not finish. Retry this upload.",
          );
        const { checksum } = await import("./derivatives");
        if (
          checksum(new Uint8Array(await existing.data.arrayBuffer())) !==
          file.checksum
        )
          throw new ApiError(
            409,
            "A stored derivative did not match. Contact an administrator.",
          );
      }
      files.push({ ...file, data: undefined, bucket: job.bucket, object_path });
    }
    const original = {
      variant: "original",
      bucket: "media-archive",
      object_path: job.source_path,
      mime_type: image.mime,
      byte_size: input.length,
      checksum: image.sourceChecksum,
      width: image.width,
      height: image.height,
    };
    const master = files.at(-1)!;
    const saved = await db.rpc("complete_media_upload", {
      job_id: id,
      lease_id: lease,
      master,
      files: [original, ...files],
    });
    databaseError(saved.error);
    return { id: saved.data as string, state: "ready" };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "The image could not be processed. Choose a valid still image or retry.";
    await db
      .from("media_upload_jobs")
      .update({
        state: "failed",
        lease: null,
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("lease", lease);
    throw error instanceof ApiError ? error : new ApiError(400, message);
  }
}
