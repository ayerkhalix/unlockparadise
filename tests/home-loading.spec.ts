import { test, expect } from "@playwright/test";

test("home paints its responsive hero without a route offset, then enhances live map counts", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  const transformations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/render/image/"))
      transformations.push(request.url());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hero = page.locator(".upd-hero-bg > img");
  await expect(hero).toHaveAttribute("fetchpriority", "high");
  await expect(hero).toHaveAttribute("loading", "eager");
  await expect(hero).toHaveAttribute("srcset", /1080w/);
  await expect
    .poll(() =>
      hero.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const layout = await page.locator(".upd-site").evaluate((node) => ({
    padding: getComputedStyle(node).paddingTop,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  expect(layout).toEqual({ padding: "0px", overflow: false });
  // A cover image on a tall phone needs more pixels than the viewport's width.
  expect(
    await hero.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThanOrEqual(1080);
  const chips = page.locator("[data-home-category]");
  expect(await chips.count()).toBeGreaterThan(4);
  await expect(chips.first()).toHaveAttribute(
    "aria-label",
    /: \d+ destinations$/,
  );
  expect(
    await chips.evaluateAll((nodes) =>
      nodes.every(
        (node) => node.tagName === "SPAN" && !node.hasAttribute("href"),
      ),
    ),
  ).toBe(true);
  await expect(page.locator(".p2-main-area-map")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Start exploring the map", exact: true }),
  ).toHaveAttribute("href", "#palawan-map");
  await expect(page.locator("#featured")).toBeVisible();
  expect(transformations).toEqual([]);
});
