import "server-only";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "@/lib/http";
export async function validatedImage(
  file: File,
  { avatar = false }: { avatar?: boolean } = {},
) {
  const max = avatar ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
  if (!file.size || file.size > max)
    throw new ApiError(413, `Use an image up to ${avatar ? "8" : "20"} MB.`);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new ApiError(400, "Use a JPG, PNG or WebP image.");
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const pipeline = sharp(input, {
      limitInputPixels: 40000000,
      failOn: "error",
      animated: false,
    });
    const meta = await pipeline.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      !meta.width ||
      !meta.height
    )
      throw new Error("Invalid image");
    let processed = pipeline.rotate();
    if (avatar) {
      const normalized = await processed.toBuffer({ resolveWithObject: true });
      const { width, height } = normalized.info;
      const size = Math.min(width, height);
      const left = Math.floor((width - size) / 2),
        top = Math.floor((height - size) / (height > width ? 3 : 2));
      processed = sharp(normalized.data)
        .extract({ left, top, width: size, height: size })
        .resize(192, 192);
    } else
      processed = processed.resize({
        width: 4096,
        height: 4096,
        fit: "inside",
        withoutEnlargement: true,
      });
    const { data, info } = await processed
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      mime: "image/webp",
      width: info.width,
      height: info.height,
      checksum: createHash("sha256").update(data).digest("hex"),
      name: randomUUID() + ".webp",
    };
  } catch {
    throw new ApiError(
      400,
      "The image could not be decoded. Choose another file.",
    );
  }
}
