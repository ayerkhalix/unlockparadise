import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { signIn } from "./helpers/demo-session";

test.use({ deviceScaleFactor: 3 });

test("high-density itinerary photos keep their sharp candidate after load", async ({
  page,
  context,
}) => {
  await signIn(context, "explorerplus2@paradise.com");
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  const catalog = await context.request.get(
    "/api/v1/planning-places/?search=Tagkawayan",
  );
  expect(catalog.ok()).toBe(true);
  const source = (await catalog.json()).data[0];
  const widths: number[] = [];
  const transforms: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/media/"))
      widths.push(Number(url.searchParams.get("width")));
    if (url.pathname.includes("/storage/v1/render/image/"))
      transforms.push(url.pathname);
  });
  await page.route("**/api/v1/itineraries/library/**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: randomUUID(),
            title: "High-density photo check",
            area_id: null,
            area: "Puerto Princesa City",
            start_date: null,
            end_date: null,
            day_count: 2,
            stop_count: 1,
            image: source.image,
            images: [source.image],
          },
        ],
        areas: [],
        count: 1,
        total: 1,
        page: 1,
        pages: 1,
        pageSize: 12,
      },
    }),
  );
  await page.goto("/itineraries/");
  const image = page.locator(".itinerary-library-card__photo img").first();
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      { timeout: 25000 },
    )
    .toBe(true);
  // Let React's load callback run: density-corrected naturalWidth must never cap srcset.
  await page.waitForTimeout(1000);
  await expect(image).toHaveAttribute("srcset", /1920w/);
  const final = await image.evaluate((img: HTMLImageElement) => ({
    src: img.currentSrc,
    width: img.clientWidth,
    height: img.clientHeight,
    dpr: devicePixelRatio,
  }));
  const response = await context.request.get(final.src);
  expect(response.ok()).toBe(true);
  const encoded = await sharp(await response.body()).metadata();
  expect(
    Math.min(encoded.width! / final.width, encoded.height! / final.height) /
      final.dpr,
  ).toBeGreaterThanOrEqual(0.9);
  expect(widths).not.toContain(256);
  expect(transforms).toEqual([]);
});
