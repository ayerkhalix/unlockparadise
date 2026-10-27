import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: process.env.MEMBER_PREVIEW_URL
    ? "**/member-preview.spec.ts"
    : [
        "**/site.spec.ts",
        "**/backend.spec.ts",
        "**/phase2.spec.ts",
        "**/admin-studio.spec.ts",
        "**/phase31.spec.ts",
        "**/traveler.spec.ts",
        "**/browsing-expansion.spec.ts",
        "**/account-planner-refinement.spec.ts",
        "**/xendit.spec.ts",
        "**/planner-time-refinement.spec.ts",
        "**/member-identity-map.spec.ts",
        "**/floating-dock.spec.ts",
        "**/ui-polish.spec.ts",
        "**/auth-privacy.spec.ts",
        "**/admin-redesign.spec.ts",
        "**/planner-client-update.spec.ts",
        "**/client-todo.spec.ts",
        "**/ux-polish-next.spec.ts",
        "**/planner-refinement.spec.ts",
        "**/safari-time.spec.ts",
        "**/client-plan-oct26.spec.ts",
        "**/itinerary-library.spec.ts",
        "**/itinerary-photo-polish.spec.ts",
        "**/performance-images.spec.ts",
        "**/home-loading.spec.ts",
      ],
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "chrome" : undefined),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    deviceScaleFactor: 1,
    timezoneId: "Asia/Manila",
  },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile-390",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
