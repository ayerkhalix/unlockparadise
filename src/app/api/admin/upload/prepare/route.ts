import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  api,
  input,
  json,
  verifyOrigin,
  databaseError,
  ApiError,
} from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { privilegedSupabase } from "@/lib/supabase/server";
import { imageRecipe } from "@/lib/storage/derivatives";
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireStaff(request);
    await rateLimit("admin-upload-prepare", current.user.id, 30, 600);
    const body = await input(
      request,
      z.object({
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().int().min(1).max(20971520),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        visibility: z.enum(["public", "private"]),
        alt: z.string().max(1000).default(""),
      }),
    );
    const db = privilegedSupabase();
    const id = randomUUID();
    const bucket =
      body.visibility === "public"
        ? "destination-public"
        : "destination-private";
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[body.mime];
    const existing = await db
      .from("media_upload_jobs")
      .select("id,state,media_id,source_path")
      .eq("owner_id", current.user.id)
      .eq("source_checksum", body.checksum)
      .eq("bucket", bucket)
      .eq("recipe", imageRecipe)
      .maybeSingle();
    databaseError(existing.error);
    let job = existing.data;
    if (!job) {
      const made = await db.from("media_upload_jobs").upsert(
        {
          id,
          owner_id: current.user.id,
          bucket,
          source_path: `admin-originals/${current.user.id}/${id}.${ext}`,
          source_mime: body.mime,
          source_bytes: body.size,
          source_checksum: body.checksum,
          alt: body.alt,
          recipe: imageRecipe,
        },
        {
          onConflict: "owner_id,source_checksum,bucket,recipe",
          ignoreDuplicates: true,
        },
      );
      databaseError(made.error);
      const row = await db
        .from("media_upload_jobs")
        .select("id,state,media_id,source_path")
        .eq("owner_id", current.user.id)
        .eq("source_checksum", body.checksum)
        .eq("bucket", bucket)
        .eq("recipe", imageRecipe)
        .single();
      databaseError(row.error);
      job = row.data;
    }
    if (job!.state === "ready") {
      const existingMedia = await db
        .from("media")
        .select("id")
        .eq("id", job!.media_id)
        .maybeSingle();
      databaseError(existingMedia.error);
      if (existingMedia.data)
        return json({ data: { id: job!.media_id, state: "ready" } });
      // An administrator may have subsequently deleted the unassociated media.
      const reset = await db
        .from("media_upload_jobs")
        .update({
          state: "prepared",
          media_id: randomUUID(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job!.id)
        .eq("state", "ready")
        .select("id,state,media_id,source_path")
        .single();
      databaseError(reset.error);
      job = reset.data;
    }
    const signed = await db.storage
      .from("media-archive")
      .createSignedUploadUrl(job!.source_path, { upsert: false });
    if (signed.error || !signed.data)
      throw new ApiError(
        503,
        "The original upload could not start. Try again.",
      );
    return json({
      data: {
        job_id: job!.id,
        state: job!.state,
        upload_url: signed.data!.signedUrl,
      },
    });
  });
}
