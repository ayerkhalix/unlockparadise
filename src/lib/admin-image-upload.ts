/** Direct upload keeps the exact original out of function request bodies. */
export async function uploadAdminImage(
  file: File,
  visibility: string,
  alt: string,
  progress?: (message: string) => void,
  signal?: AbortSignal,
) {
  if (
    !file.size ||
    file.size > 20 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error("Choose a JPG, PNG or WebP image up to 20 MB.");
  progress?.("Checking original…");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const prepared = await fetch("/api/admin/upload/prepare/", {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mime: file.type,
      size: file.size,
      checksum: hash,
      visibility,
      alt,
    }),
  });
  const result = await prepared.json();
  if (!prepared.ok) throw Error(result.error || "Upload could not start.");
  if (result.data.state === "ready") return result.data as { id: string };
  progress?.("Uploading original…");
  const uploaded = await fetch(result.data.upload_url, {
    signal,
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "x-upsert": "false",
      "Cache-Control": "max-age=60",
    },
    body: file,
  });
  // A retry may find the already uploaded immutable original; the server verifies its checksum.
  if (!uploaded.ok && ![400, 409].includes(uploaded.status))
    throw Error("Original upload failed. Select the file again to retry.");
  progress?.("Preparing image sizes…");
  for (let attempt = 0; attempt < 65; attempt++) {
    const response = await fetch(`/api/admin/upload/${result.data.job_id}/`, {
      signal,
      method: "POST",
    });
    const completed = await response.json();
    if (!response.ok)
      throw Error(
        completed.error || "Processing failed. Select the file again to retry.",
      );
    if (completed.data.state === "ready")
      return completed.data as { id: string };
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw Error(
    "The original is saved. Select the file again to resume processing.",
  );
}
