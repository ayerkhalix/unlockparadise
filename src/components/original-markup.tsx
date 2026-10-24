import { imageDeliveryUrl, responsiveImage } from "@/lib/image-delivery";

/** Static public markup, sanitized at import time. No WordPress scripts execute here. */
export function OriginalMarkup({ html }: { html: string }) {
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const optimized = html
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const source = tag
        .match(/\bsrc="([^"]+)"/)?.[1]
        ?.replaceAll("&amp;", "&");
      if (!source) return tag;
      const delivery = responsiveImage(source);
      if (!delivery.srcSet) return tag;
      const sizes = tag.match(/\bsizes="([^"]+)"/)?.[1] || "100vw";
      return tag
        .replace(/\s+(?:src|srcset|sizes)="[^"]*"/gi, "")
        .replace(
          /\/?\s*>$/,
          ` src="${escape(delivery.src)}" srcset="${escape(delivery.srcSet)}" sizes="${sizes}" />`,
        );
    })
    .replace(
      /background-image:\s*url\('(\/original\/[^']+)'\)/g,
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
