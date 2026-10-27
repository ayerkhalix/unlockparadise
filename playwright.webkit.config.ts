import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: [
    "**/safari-time.spec.ts",
    "**/client-plan-oct26.spec.ts",
    "**/itinerary-library.spec.ts",
    "**/itinerary-photo-polish.spec.ts",
        "**/performance-images.spec.ts",
  ],
  use: { ...base.use, browserName: "webkit", channel: undefined },
  projects: [
    { name: "webkit-desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "webkit-phone",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
