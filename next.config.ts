import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: {"/*":["./reference/**/*","./artifacts/**/*","./.env*","./src/data/destinations.private.json"]},
  outputFileTracingIncludes: {"/*":["./src/lib/generated/media-routing.json"]},
  distDir: process.env.NODE_ENV === "development" && process.env.PHASE1_PREVIEW_TIER ? `.next-preview-${process.env.PHASE1_PREVIEW_TIER}` : ".next",
  turbopack: { root: process.cwd() },
  devIndicators: false,
  trailingSlash: true,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
    ] }];
  }
};
export default config;
