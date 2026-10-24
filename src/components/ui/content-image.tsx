"use client";
import { useState, type ComponentProps } from "react";
import { responsiveImage } from "@/lib/image-delivery";

export function ContentImage({
  alt = "",
  src,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw",
  fetchPriority,
  loading = fetchPriority === "high" ? "eager" : "lazy",
  ...props
}: ComponentProps<"img">) {
  const [failed, setFailed] = useState<unknown>(null);
  const [original, setOriginal] = useState<unknown>(null);
  const source = typeof src === "string" ? src : "";
  const delivery = original === src ? { src } : responsiveImage(source);
  return failed === src ? (
    <span
      className={`${className || ""} p2-photo-fallback`}
      role={alt ? "img" : undefined}
      aria-label={alt ? `${alt} — photo unavailable` : undefined}
      aria-hidden={!alt || undefined}
    >
      Photo unavailable
    </span>
  ) : (
    <img
      {...props}
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setFailed(src);
      }}
      {...delivery}
      sizes={sizes}
      loading={loading}
      fetchPriority={fetchPriority}
      alt={alt}
      className={className}
      decoding="async"
      onError={() => {
        if (delivery.src !== src) setOriginal(src);
        else setFailed(src);
      }}
    />
  );
}
