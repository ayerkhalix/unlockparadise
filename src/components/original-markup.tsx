import { imageDeliveryUrl, responsiveImage } from "@/lib/image-delivery";
import {
  sourceFocalPoint,
  focalPosition,
  stripFocalPoint,
} from "@/lib/focal-point";

/** Static public markup, sanitized at import time. No WordPress scripts execute here. */
export function OriginalMarkup({ html }: { html: string }) {
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const optimized = html
    .replace(
      /<div class="upd-hero-bg" style="background-image:\s*url\(['"]?(\/original\/[^)'"\s]+)['"]?\)"><\/div>/g,
      (_, source: string) =>
        `<div class="upd-hero-bg"><img src="${escape(source)}" alt="" aria-hidden="true" sizes="(max-width: 767px) 204svh, (max-aspect-ratio: 16/9) 181vh, 100vw" fetchpriority="high" loading="eager" decoding="async" /></div>`,
    )
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const source = tag
        .match(/\bsrc="([^"]+)"/)?.[1]
        ?.replaceAll("&amp;", "&");
      if (!source) return tag;
      const delivery = responsiveImage(source);
      const focal = sourceFocalPoint(source);
      const recovery =
        source.startsWith("/") && !source.startsWith("//")
          ? ` data-image-original="${escape(stripFocalPoint(source))}"`
          : "";
      if (!delivery.srcSet && !focal)
        return tag.replace(/\/?\s*>$/, `${recovery} />`);
      const sizes = tag.match(/\bsizes="([^"]+)"/)?.[1] || "100vw";
      const style = tag.match(/\bstyle="([^"]*)"/)?.[1] || "";
      return tag
        .replace(/\s+(?:src|srcset|sizes)="[^"]*"/gi, "")
        .replace(focal ? /\s+style="[^"]*"/gi : /$^/, "")
        .replace(
          /\/?\s*>$/,
          ` src="${escape(delivery.src)}"${delivery.srcSet ? ` srcset="${escape(delivery.srcSet)}" sizes="${sizes}"` : ""}${focal ? ` style="${escape(style)};object-position:${focalPosition(focal)};object-fit:cover"` : ""}${recovery} />`,
        );
    })
    .replace(
      /background-image:\s*url\(['"]?(\/original\/[^)'"\s]+)['"]?\)/g,
      (_, source: string) =>
        `background-image:url('${escape(imageDeliveryUrl(source, 1920))}')`,
    );
  return (
    <div
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: optimized }}
    />
  );
}
