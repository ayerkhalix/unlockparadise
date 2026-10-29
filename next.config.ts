import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  images: {
    deviceSizes: [640, 1080, 1920],
    imageSizes: [256, 384],
    qualities: [75],
    formats: ["image/webp"],
    localPatterns: [{ pathname: "/original/**" }],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./reference/**/*",
      "./artifacts/**/*",
      "./.env*",
      "./src/data/destinations.private.json",
    ],
  },
  outputFileTracingIncludes: {
    "/*": ["./src/lib/generated/media-routing.json"],
  },
  distDir:
    process.env.NODE_ENV === "development" && process.env.PHASE1_PREVIEW_TIER
      ? `.next-preview-${process.env.PHASE1_PREVIEW_TIER}`
      : ".next",
  turbopack: { root: process.cwd() },
  devIndicators: false,
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/merch/optimized/:path*",
        headers: [
          { key: "Cache-Control", value: "public,max-age=31536000,immutable" },
        ],
      },
      {
        source: "/site/optimized/:path*",
        headers: [
          { key: "Cache-Control", value: "public,max-age=31536000,immutable" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default config;
