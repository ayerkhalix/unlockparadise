export type StoredImage = {
  bucket: string;
  object_path: string;
  mime_type: string;
  status: string;
  width?: number | null;
  height?: number | null;
  original_path?: string | null;
  checksum?: string | null;
  variant?: string;
};
const raster = /^image\/(jpeg|png|webp|avif|gif)$/;
/** Never serve an archive or cross a parent's visibility boundary. */
export function storedImage(
  parent: StoredImage,
  files: StoredImage[],
  width?: number,
  variant?: string | null,
) {
  const allowed = files.filter(
    (f) =>
      f.status === "ready" &&
      f.bucket === parent.bucket &&
      raster.test(f.mime_type),
  );
  if (width && width > 0) {
    const candidates = [...allowed, parent].filter(
      (f) => f.width && raster.test(f.mime_type),
    );
    candidates.sort(
      (a, b) =>
        a.width! - b.width! ||
        Number(b.mime_type === "image/webp") -
          Number(a.mime_type === "image/webp") ||
        a.object_path.localeCompare(b.object_path),
    );
    const selected =
      candidates.find((f) => f.width! >= width) || candidates.at(-1);
    if (selected) return selected;
  }
  return allowed.find((f) => f.variant === variant) || parent;
}
