import { api, ApiError, json, verifyOrigin, uploadForm } from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
import { checksum } from "@/lib/storage/derivatives";
import { POST as prepareUpload } from "./prepare/route";
import { finishAdminUpload } from "@/lib/storage/admin-upload";
import { rateLimit } from "@/lib/rate-limit";
export const maxDuration = 120;
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const prepared = await prepareUpload(
      new Request(new URL("/api/admin/upload/prepare/", request.url), {
        method: "POST",
        headers,
        body: JSON.stringify({
          mime: file.type,
          size: file.size,
          checksum: checksum(bytes),
          visibility:
            form.get("visibility") === "public" ? "public" : "private",
          alt: String(form.get("alt") || "").slice(0, 1000),
        }),
      }),
    );
    if (!prepared.ok) return prepared;
    const { data } = await prepared.json();
    if (data.state === "ready") return json({ data: { id: data.id } }, 201);
    const upload = await fetch(data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type, "x-upsert": "false" },
      body: bytes,
    });
    if (!upload.ok && ![400, 409].includes(upload.status))
      throw new ApiError(503, "Upload failed.");
    const result = await finishAdminUpload(data.job_id, current.user.id);
    return json({ data: result }, result.state === "ready" ? 201 : 202);
  });
}
