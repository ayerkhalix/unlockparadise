"use client";
import { useState, type ComponentProps } from "react";

export function ContentImage({
  alt = "",
  src,
  className,
  ...props
}: ComponentProps<"img">) {
  const [failed, setFailed] = useState<unknown>(null);
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
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      onError={() => setFailed(src)}
    />
  );
}
