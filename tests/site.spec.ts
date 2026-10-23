import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  // Match the recorder: inspect production resources with GET only.
  await page.route("**/*", (route) => {
    const request = route.request();
    if (
      !["GET", "HEAD"].includes(request.method()) &&
      request.url().startsWith("https://")
    )
      return route.abort();
    return route.continue();
  });
});

test("homepage keeps original sections, photos and responsive dimensions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".upd-hero-logo")).toBeVisible();
  await expect(page.locator(".upd-hero-logo")).toHaveAccessibleName(
    "Unlock Paradise",
  );
  await expect(page.locator(".upd-fcard")).toHaveCount(4);
  await expect(page.locator(".upd-cat-chip")).toHaveCount(6);
  await expect(page.locator(".map-overlay")).not.toHaveClass(/active/);
  await expect(page.locator("footer")).toContainText("The side of Palawan");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
  await expect(page.locator("#palawan-map")).toHaveAttribute(
    "data-map-ready",
    "true",
    { timeout: 35000 },
  );
  await expect(page.locator(".map-area-target")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("map selects exact areas, closes, and navigates to an available category", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#palawan-map")).toHaveAttribute(
    "data-map-ready",
    "true",
    { timeout: 35000 },
  );
  await page
    .locator("#palawan-map")
    .evaluate((el) =>
      el.scrollIntoView({ behavior: "instant", block: "center" }),
    );
  await page
    .getByRole("button", { name: "Explore Puerto North", exact: true })
    .click();
  await expect(page.locator(".map-overlay")).toHaveClass(/active/);
  await expect(page.locator("#overlay-area-name")).toHaveText("Puerto North");
  await expect(page.locator(".category-btn")).toHaveCount(6);
  await page.getByRole("button", { name: "Back to Map", exact: true }).click();
  await expect(page.locator(".map-overlay")).not.toHaveClass(/active/);
  await page.waitForTimeout(1600);
  await page
    .getByRole("button", { name: "Explore Puerto North", exact: true })
    .click();
  await expect(page.locator(".map-overlay")).toHaveClass(/active/);
  await page.locator('.category-btn[data-cat="beaches"]').click();
  await expect(page).toHaveURL(/\/area\/ppc-north\/beaches\//);
  await expect(page.locator(".upd-card").first()).toBeVisible();
});

test("archive search, sorting, accessible-by facets and reset work locally", async ({
  page,
  isMobile,
}) => {
  await page.goto("/area/ppc-north/beaches/");
  await expect(page.locator("#original-area-filter")).toBeAttached();
  await expect(page.locator(".upd-card:not(.is-hidden)").first()).toBeVisible();
  if (isMobile) await page.locator('[data-ctl="advanced"]').click();
  const all = await page.locator(".upd-card:not(.is-hidden)").count();
  await page.locator('[data-ctl="search"]').fill("mandyukot");
  await expect(page.locator(".upd-card:not(.is-hidden)")).toHaveCount(1);
  await expect(page).toHaveURL(/q=mandyukot/);
  await page.locator('[data-ctl="search"]').fill("a place that does not exist");
  await expect(page.locator(".upd-card:not(.is-hidden)")).toHaveCount(0);
  await page
    .locator('[data-ctl="reset"]')
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.locator(".upd-card:not(.is-hidden)")).toHaveCount(all);
  if (isMobile && !(await page.locator('[data-ctl="search"]').isVisible()))
    await page.locator('[data-ctl="advanced"]').click();
  await page.locator('[data-ctl="sort"]').selectOption("name");
  const names = await page
    .locator(".upd-card:not(.is-hidden)")
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-title")));
  expect(names).toEqual(
    [...names].sort((a, b) => (a || "").localeCompare(b || "")),
  );
  await page
    .locator('input[data-ctl="access"][value="boat"]')
    .locator("..")
    .click();
  const access = await page
    .locator(".upd-card:not(.is-hidden)")
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-access")));
  expect(access.every((value) => value?.includes("boat"))).toBe(true);
});

test("public gates never serialize protected descriptions, coordinates or full galleries", async ({
  page,
  request,
}) => {
  const privateData = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "src/data/destinations.private.json"),
      "utf8",
    ),
  );
  const place = privateData.find(
    (p: { slug: string }) => p.slug === "bayog-beach",
  );
  const response = await request.get(
    "/place/bayog-beach/?tier=explorer-plus&preview=1",
  );
  const body = await response.text();
  expect(body).toContain("upd-gate");
  expect(body).not.toContain("place-map-embed");
  expect(body).not.toContain("upd-gallery__photo");
  for (const url of place.gallery.slice(2)) expect(body).not.toContain(url);
  if (place.coordinates)
    for (const value of place.coordinates)
      expect(body).not.toContain(String(value));
  await page.goto("/place/100-cafe-moto/");
  await expect(page.locator(".upd-gate__heading")).toHaveText(
    "You need a free Explorer account to view this place",
  );
  await expect(page.locator(".upd-plans__col")).toHaveCount(3);
  const forbidden = await request.get("/src/data/destinations.private.json");
  expect(forbidden.status()).toBe(404);
});

test("public navigation pages render and account forms use local backend endpoints", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const route of [
    "/about/",
    "/membership/",
    "/contact/",
    "/login/",
    "/join/",
    "/forgot-password/",
    "/privacy-policy/",
    "/terms/",
    "/refunds/",
    "/place_category/beaches/",
  ]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("#upd-main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("/login/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  expect(await page.locator("form").getAttribute("action")).not.toContain(
    "unlockparadise.ph",
  );
});

test("mobile drawer supports focus, Escape and navigation", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Drawer is the phone/tablet navigation.");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("dialog", { name: "Explore Unlock Paradise", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page
    .getByRole("navigation", { name: "Mobile", exact: true })
    .getByRole("link", { name: "About", exact: true })
    .click();
  await expect(page).toHaveURL(/\/about\//);
});
