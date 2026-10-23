import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
const sharedUse = { ...base.use };
delete sharedUse.channel;

export default defineConfig({
  ...base,
  use: sharedUse,
  testMatch: "**/ui-polish.spec.ts",
  timeout: 90000,
  projects: [
    {
      name: "desktop-chrome",
      use: { viewport: { width: 1440, height: 1000 }, channel: "chrome" },
    },
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], channel: undefined },
    },
  ],
});
