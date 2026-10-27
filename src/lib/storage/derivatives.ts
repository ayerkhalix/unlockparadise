import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { ApiError } from "@/lib/http";

export const imageRecipe = "webp-v1";
export const checksum = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function imageDerivatives(
  input: Buffer,
  declaredMime: string,
  { maximum = 4096 }: { maximum?: number } = {},
) {
  if (!input.length || input.length > 20 * 1024 * 1024)
    throw new ApiError(413, "Use an image up to 20 MB.");
  const image = sharp(input, { limitInputPixels: 40000000, failOn: "error" });
  const meta = await image.metadata();
  const mime = (
    { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<
      string,
      string
    >
  )[meta.format || ""];
  if (!mime || mime !== declaredMime)
    throw new ApiError(400, "Choose a valid JPG, PNG or WebP image.");
  if ((meta.pages || 1) > 1)
    throw new ApiError(
      400,
      "Animated uploads are not supported. Choose a still image.",
    );
  const normalized = image.rotate().withIccProfile("srgb");
  const rotated = (meta.orientation || 0) >= 5;
  const width = (rotated ? meta.height : meta.width)!;
  const height = (rotated ? meta.width : meta.height)!;
  const sizes = [
    ...new Set(
      [256, 384, 640, 1080, 1920, Math.min(maximum, width)].filter(
        (w) => w <= width && w <= maximum,
      ),
    ),
  ].sort((a, b) => a - b);
  const files = [];
  for (const size of sizes) {
    const { data, info } = await normalized
      .clone()
      .resize({ width: size, withoutEnlargement: true })
      .webp({
        quality: 88,
        alphaQuality: 100,
        lossless: meta.hasAlpha || mime === "image/png",
      })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 20 * 1024 * 1024) continue;
    files.push({
      variant: `w${size}`,
      data,
      mime_type: "image/webp",
      width: info.width,
      height: info.height,
      byte_size: data.length,
      checksum: checksum(data),
    });
  }
  return { files, width, height, mime, sourceChecksum: checksum(input) };
}
