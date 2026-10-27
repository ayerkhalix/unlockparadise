"use client";
import { useState, type ComponentProps } from "react";
import { responsiveImage } from "@/lib/image-delivery";
import {
  sourceFocalPoint,
  focalPosition,
  stripFocalPoint,
} from "@/lib/focal-point";

export function ContentImage({
  alt = "",
  src,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw",
  fetchPriority,
  loading = fetchPriority === "high" ? "eager" : "lazy",
  style,
  ...props
}: ComponentProps<"img">) {
  const [failed, setFailed] = useState<unknown>(null);
  const [original, setOriginal] = useState<unknown>(null);
  const [dimensions, setDimensions] = useState<{
    source: string;
    max: number;
  } | null>(null);
  const source = typeof src === "string" ? src : "";
  const delivery =
    original === src
      ? { src: stripFocalPoint(source) }
      : responsiveImage(
          source,
          dimensions?.source === source ? dimensions.max : undefined,
        );
  const focal = sourceFocalPoint(source);
  const recover = () => {
    if (
      original !== src &&
      responsiveImage(source).src !== stripFocalPoint(source)
    )
      setOriginal(src);
    else setFailed(src);
  };
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
        if (node?.complete && node.naturalWidth === 0) recover();
      }}
      {...delivery}
      sizes={sizes}
      loading={loading}
      fetchPriority={fetchPriority}
      alt={alt}
      className={className}
      decoding="async"
      onLoad={(event) => {
        const image = event.currentTarget;
        const requested = Number(
          new URL(image.currentSrc, location.href).searchParams.get("width"),
        );
        if (requested && image.naturalWidth < requested)
          setDimensions({ source, max: image.naturalWidth });
        props.onLoad?.(event);
      }}
      style={{
        ...(focal
          ? { objectPosition: focalPosition(focal), objectFit: "cover" }
          : {}),
        ...style,
      }}
      onError={recover}
    />
  );
}
