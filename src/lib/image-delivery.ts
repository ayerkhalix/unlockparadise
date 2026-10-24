/** Public files use Next's cache. Authenticated media stays behind its RLS route. */
export const imageWidths = [256, 384, 640, 1080, 1920] as const;
export function imageDeliveryUrl(source: string, width: number) {
  if (!imageWidths.includes(width as (typeof imageWidths)[number]))
    return source;
  if (/^\/api\/media\/[0-9a-f-]{36}\/?(?:\?|$)/i.test(source)) {
    const url = new URL(source, "https://local.invalid");
    url.searchParams.set("width", String(width));
    return url.pathname + url.search;
  }
  if (/^\/original\/[^?#]+\.(?:jpe?g|png|webp|avif)(?:\?[^#]*)?$/i.test(source))
    return `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
  return source;
}
export function responsiveImage(source: string) {
  const src = imageDeliveryUrl(source, 640);
  return {
    src,
    ...(src !== source
      ? {
          srcSet: imageWidths
            .map((w) => `${imageDeliveryUrl(source, w)} ${w}w`)
            .join(", "),
        }
      : {}),
  };
}
