import { stripFocalPoint } from "./focal-point";
import merchImages from "@/data/merch-images.json";
import siteImages from "@/data/site-images.json";
const editorial = siteImages as Record<
  string,
  { width: number; height: number; files: Record<string, string> }
>;
const localCopies: Record<string, Record<string, string>> = {
  ...merchImages,
  ...Object.fromEntries(
    Object.entries(editorial).map(([source, image]) => [source, image.files]),
  ),
};
export function localImageAspectRatio(source: string) {
  const image = editorial[stripFocalPoint(source)];
  return image ? image.width / image.height : null;
}
/** Public assets use prepared copies or Next's cache. Private media keeps its RLS route. */
export const imageWidths = [256, 384, 640, 1080, 1920] as const;
export function imageDeliveryUrl(source: string, width: number) {
  if (!imageWidths.includes(width as (typeof imageWidths)[number]))
    return source;
  source = stripFocalPoint(source);
  if (localCopies[source]) {
    const widths = Object.keys(localCopies[source])
      .map(Number)
      .sort((a, b) => a - b);
    return localCopies[source][
      widths.find((w) => w >= width) || widths.at(-1)!
    ];
  }
  if (/^\/api\/media\/[0-9a-f-]{36}\/?(?:\?|$)/i.test(source)) {
    const url = new URL(source, "https://local.invalid");
    url.searchParams.set("width", String(width));
    url.searchParams.set("resize", "contain");
    return url.pathname + url.search;
  }
  if (/^\/original\/[^?#]+\.(?:jpe?g|png|webp|avif)(?:\?[^#]*)?$/i.test(source))
    return `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
  return source;
}
export function responsiveImage(source: string, maxWidth?: number) {
  source = stripFocalPoint(source);
  if (localCopies[source]) {
    const copies = localCopies[source];
    const widths = Object.keys(copies)
      .map(Number)
      .filter((w) => !maxWidth || w <= maxWidth)
      .sort((a, b) => a - b);
    if (!widths.length) return { src: source };
    return {
      src: copies[widths.find((w) => w >= 640) || widths.at(-1)!],
      srcSet: widths.map((w) => `${copies[w]} ${w}w`).join(", "),
    };
  }
  const widths = maxWidth
    ? imageWidths.filter((w) => w <= maxWidth)
    : imageWidths;
  const src = widths.length
    ? imageDeliveryUrl(source, widths.includes(640) ? 640 : widths.at(-1)!)
    : source;
  return {
    src,
    ...(src !== source
      ? {
          srcSet: widths
            .map((w) => `${imageDeliveryUrl(source, w)} ${w}w`)
            .join(", "),
        }
      : {}),
  };
}
