import { z } from "zod";
export const focalPointInput = z
  .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
  .strict();
export type FocalPoint = z.infer<typeof focalPointInput>;
export const centeredFocalPoint: FocalPoint = { x: 50, y: 50 };
export function focalPosition(point?: FocalPoint) {
  return `${point?.x ?? 50}% ${point?.y ?? 50}%`;
}
export function associationFocalPoint(
  row?: { focal_x?: number | string; focal_y?: number | string } | null,
): FocalPoint {
  const parsed = focalPointInput.safeParse({
    x: Number(row?.focal_x ?? 50),
    y: Number(row?.focal_y ?? 50),
  });
  return parsed.success ? parsed.data : centeredFocalPoint;
}
export function withFocalPoint(source: string, point?: FocalPoint) {
  if (!point || !source.startsWith("/") || source.startsWith("//"))
    return source;
  const url = new URL(source, "https://local.invalid");
  url.searchParams.delete("focus_x");
  url.searchParams.delete("focus_y");
  if (point.x !== 50 || point.y !== 50) {
    url.searchParams.set("focus_x", String(point.x));
    url.searchParams.set("focus_y", String(point.y));
  }
  return url.pathname + url.search;
}
export function sourceFocalPoint(source: string): FocalPoint | undefined {
  if (!source.startsWith("/") || source.startsWith("//")) return;
  const url = new URL(source, "https://local.invalid");
  if (!url.searchParams.has("focus_x") || !url.searchParams.has("focus_y"))
    return;
  const parsed = focalPointInput.safeParse({
    x: Number(url.searchParams.get("focus_x")),
    y: Number(url.searchParams.get("focus_y")),
  });
  return parsed.success ? parsed.data : undefined;
}
export function stripFocalPoint(source: string) {
  if (!source.startsWith("/") || source.startsWith("//")) return source;
  const url = new URL(source, "https://local.invalid");
  if (!url.searchParams.has("focus_x") && !url.searchParams.has("focus_y"))
    return source;
  url.searchParams.delete("focus_x");
  url.searchParams.delete("focus_y");
  return url.pathname + url.search;
}
/** Equivalent to CSS object-position for a cover crop. */
export function focalCoverRegion(
  width: number,
  height: number,
  point: FocalPoint,
  aspect = 4 / 3,
) {
  const cropWidth = Math.min(width, Math.round(height * aspect)),
    cropHeight = Math.min(height, Math.round(width / aspect));
  return {
    left: Math.round(((width - cropWidth) * point.x) / 100),
    top: Math.round(((height - cropHeight) * point.y) / 100),
    width: cropWidth,
    height: cropHeight,
  };
}
