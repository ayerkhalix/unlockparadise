import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { AxeBuilder } from "@axe-core/playwright";
import sharp from "sharp";
import { assertStagingProject } from "../scripts/staging-project.mjs";
const base = "http://127.0.0.1:3000";
assertStagingProject();
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const prefix = "browsing-" + randomUUID().slice(0, 8);
const products: number[] = [],
  places: string[] = [],
  brands: string[] = [],
  collections: string[] = [],
  media: string[] = [],
  trips: string[] = [];
async function login(context: BrowserContext, role = "client_admin") {
  const f = JSON.parse(
    await readFile("artifacts/staging-private/client-accounts.json", "utf8"),
  );
  expect(f.project).toBe("iitblbdqztuxdzpaetie");
  const jar = new Map<string, string>();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach((c) => jar.set(c.name, c.value)),
      },
    },
  );
  const signed = await db.auth.signInWithPassword({
    email: f.users[role].email,
    password: f.users[role].password,
  });
  expect(signed.error).toBeNull();
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      url: base,
      sameSite: "Lax" as const,
    })),
  );
  return f.users[role];
}
async function audit(page: Page, label: string) {
  await page.evaluate(() => document.fonts.ready);
  const findings = await new AxeBuilder({ page }).analyze();
  expect(findings.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  const width = page.viewportSize()!.width;
  await mkdir("artifacts/browsing-expansion/after", { recursive: true });
  await page.screenshot({
    path: `artifacts/browsing-expansion/after/${label}-${width}.png`,
    fullPage: true,
  });
  await writeFile(
    `artifacts/browsing-expansion/after/${label}-${width}-axe.json`,
    JSON.stringify({ violations: findings.violations }, null, 2),
  );
}
test.afterAll(async () => {
  const check = (r: { error: unknown }) => {
    if (r.error) throw new Error("Exact expansion fixture cleanup failed");
  };
  for (const id of trips)
    check(await service.from("itineraries").delete().eq("id", id));
  for (const id of products) {
    check(await service.from("merch_variants").delete().eq("product_id", id));
    check(
      await service
        .from("merch_products")
        .delete()
        .eq("id", id)
        .like("slug", prefix + "%"),
    );
  }
  for (const id of places) {
    check(await service.from("place_details").delete().eq("place_id", id));
    check(
      await service
        .from("places")
        .delete()
        .eq("id", id)
        .like("slug", prefix + "%"),
    );
  }
  for (const id of collections)
    check(
      await service
        .from("merch_collections")
        .delete()
        .eq("id", id)
        .like("name", prefix + "%"),
    );
  for (const id of brands)
    check(
      await service
        .from("merch_brands")
        .delete()
        .eq("id", id)
        .like("name", prefix + "%"),
    );
  for (const id of media) {
    const row = await service
      .from("media")
      .select("bucket,object_path")
      .eq("id", id)
      .single();
    check(row);
    check(await service.from("media").delete().eq("id", id));
    check(
      await service.storage
        .from(row.data!.bucket)
        .remove([row.data!.object_path]),
    );
  }
});
test("home carousel, featured actions and navigation", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Take a little paradise with you." }),
  ).toBeVisible();
  await expect(
    page.locator(".p2-featured-card [data-add-itinerary]"),
  ).toHaveCount(0);
  const rail = page.locator(".home-merch__rail");
  await page.getByRole("button", { name: "Next merchandise" }).click();
  await expect
    .poll(() => rail.evaluate((n) => n.scrollLeft))
    .toBeGreaterThan(0);
  if (isMobile)
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Mobile" : "Primary",
    exact: true,
  });
  await expect(
    nav.locator("a").filter({ hasNotText: /Sign in|Register/ }),
  ).toHaveText([
    "About",
    "Membership",
    "Merch",
    "Contact Us",
    "Itinerary Planner",
  ]);
  await nav.locator("summary").click();
  await expect(
    nav.getByRole("link", { name: "Register", exact: true }),
  ).toBeVisible();
  if (isMobile)
    await page
      .getByRole("button", {
        name: "Close Explore Unlock Paradise",
        exact: true,
      })
      .click();
  else await nav.locator("summary").click();
  await audit(page, "home");
});
test("merch has one cart, working filters and persistent additions", async ({
  page,
}) => {
  await page.goto("/merch/");
  await expect(
    page.getByRole("link", { name: /Open shopping cart/ }),
  ).toBeVisible();
  await expect(
    page.locator('.p2-merch-nav a[href="/merch/cart/"]'),
  ).toHaveCount(0);
  await page
    .getByLabel("Brand", { exact: true })
    .selectOption({ label: "Unlock Paradise" });
  await expect(page.getByLabel("Collection", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Unlock Paradise Collection",
      exact: true,
    }),
  ).toBeVisible();
  const fields = page.locator(".merch-filters");
  const aligned = await fields
    .locator("input,select")
    .evaluateAll((elements) =>
      elements.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
  expect(new Set(aligned).size).toBe(1);
  const categories = page.getByRole("combobox", {
    name: "Category",
    exact: true,
  });
  const category = await categories
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await categories.selectOption(category!);
  await expect(page.locator(".p2-product-card").first()).toBeVisible();
  await categories.selectOption("All");
  const card = page.locator(".p2-product-card").first();
  await card
    .getByRole("combobox", { name: /^Size for/ })
    .selectOption({ index: 1 });
  await card.getByRole("button", { name: /^Add to cart:/ }).click();
  await expect(
    page.getByRole("link", { name: /Open shopping cart 1 item/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Open shopping cart 1 item/ }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search merch" })
    .fill("no-such-piece-8472");
  await expect(
    page.getByRole("heading", { name: "No matching pieces" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Clear|Reset/ })
    .filter({ hasText: /Clear|Reset/ })
    .last()
    .click();
  await audit(page, "merch");
  const dock = page.getByRole("link", { name: /Open shopping cart 1 item/ });
  await dock.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Open shopping cart");
  await expect(tooltip).toHaveCSS("background-color", "rgb(19, 56, 66)");
  await expect(tooltip).toHaveCSS("border-top-color", "rgb(131, 217, 198)");
  await expect(tooltip).toHaveCSS("border-radius", "24px");
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
});
test("area category navigation retains the area", async ({ page }) => {
  await page.goto("/area/ppc-north/beaches/");
  const nav = page.getByRole("navigation", { name: /categories/ }).first();
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Beaches");
  const target = nav.locator('a[href$="/islands/"]');
  await target.click();
  await expect(page).toHaveURL(/\/area\/ppc-north\/islands\//);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Islands");
  await audit(page, "category");
});

test("shared dock tooltip stays readable in the light admin theme", async ({
  page,
  context,
}) => {
  await login(context);
  await page.goto("/admin/?section=merchandise");
  const light = page.getByRole("button", {
    name: "Switch to light theme",
    exact: true,
  });
  if (await light.isVisible()) await light.click();
  const dark = page.getByRole("button", {
    name: "Switch to dark theme",
    exact: true,
  });
  await expect(dark).toBeVisible();
  await page.keyboard.press("Tab");
  await dark.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Switch to dark theme");
  await expect(tooltip).toHaveCSS("background-color", "rgb(19, 56, 66)");
  await expect(tooltip).toHaveCSS("color", "rgb(244, 244, 235)");
  await expect(tooltip).toHaveCSS("border-top-color", "rgb(131, 217, 198)");
  expect(
    (await new AxeBuilder({ page }).include("#upd-tooltip").analyze())
      .violations,
  ).toEqual([]);
  await mkdir("artifacts/browsing-expansion/after", { recursive: true });
  await page.screenshot({
    path: `artifacts/browsing-expansion/after/tooltip-light-${page.viewportSize()!.width}.png`,
  });
});
test("client admin creates a brand, collection and product using uploaded photos", async ({
  page,
  context,
}) => {
  await login(context);
  await page.goto("/admin/?section=merchandise");
  await page
    .getByRole("button", { name: "Add product", exact: true })
    .first()
    .click();
  const editor = page.locator(".product-editor");
  await editor
    .getByLabel("Product name", { exact: true })
    .fill(prefix + " product");
  await editor.getByRole("button", { name: "Add brand", exact: true }).click();
  await editor.getByLabel("New brand", { exact: true }).fill(prefix + " brand");
  let response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/catalog-options/") &&
      r.request().method() === "POST",
  );
  await editor
    .locator(".catalog-choice__new")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  let result = await (await response).json();
  brands.push(result.data.id);
  await editor
    .getByRole("button", { name: "Add collection", exact: true })
    .click();
  await editor
    .getByLabel("New collection", { exact: true })
    .fill(prefix + " collection");
  response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/catalog-options/") &&
      r.request().method() === "POST",
  );
  await editor
    .locator(".catalog-choice__new")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  result = await (await response).json();
  collections.push(result.data.id);
  await editor.getByLabel("Color", { exact: true }).selectOption("Sand");
  await editor
    .getByLabel("Product price (PHP)", { exact: true })
    .fill("123.45");
  await editor.getByLabel("Stock", { exact: true }).fill("3");
  const buffer = await sharp({
    create: { width: 80, height: 80, channels: 3, background: "#83d9c6" },
  })
    .png()
    .toBuffer();
  response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/upload/") && r.request().method() === "POST",
  );
  await editor
    .getByLabel("Upload product photos", { exact: true })
    .setInputFiles({
      name: "client-test-photo.png",
      mimeType: "image/png",
      buffer,
    });
  result = await (await response).json();
  expect(result.data.id).toBeTruthy();
  media.push(result.data.id);
  await expect(
    editor.getByText("1 of 8 photos", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      editor
        .locator(".product-photo img")
        .first()
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    editor.getByRole("searchbox", { name: "Search photos" }),
  ).toHaveCount(0);
  await audit(page, "product-editor");
  response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/merchandise/") &&
      r.request().method() === "POST",
  );
  await editor
    .getByRole("button", { name: "Publish product", exact: true })
    .click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).id;
  products.push(id);
  await expect(editor).toHaveCount(0);
  const row = await service
    .from("merch_products")
    .select("*")
    .eq("id", id)
    .single();
  expect(row.data!.brand_id).toBe(brands.at(-1));
  expect(row.data!.collection_id).toBe(collections.at(-1));
  expect(row.data!.content.color).toBe("Sand");
  await page.goto("/merch/");
  await page.getByLabel("Brand", { exact: true }).selectOption(brands.at(-1)!);
  await page
    .getByLabel("Collection", { exact: true })
    .selectOption(collections.at(-1)!);
  await expect(page.locator(".p2-product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: prefix + " product", exact: true }),
  ).toBeVisible();
});
test("Place editor saves multiple access points and displays labeled locations", async ({
  page,
  context,
}) => {
  await login(context);
  await page.goto("/admin/?section=places");
  await page
    .getByRole("button", { name: "Add Place", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill(prefix + " place");
  const panel = page.locator(".access-point-editor");
  for (const [i, type] of ["Boat departure", "Trailhead"].entries()) {
    await panel
      .getByRole("button", { name: "Add access point", exact: true })
      .click();
    const field = panel.locator("fieldset").nth(i);
    await field
      .getByLabel("Name", { exact: true })
      .fill(i ? "Synthetic trail" : "Synthetic dock");
    await field.getByLabel("Type", { exact: true }).selectOption(type);
    await field
      .getByLabel("Latitude", { exact: true })
      .fill(String(10.1 + i * 0.01));
    await field
      .getByLabel("Longitude", { exact: true })
      .fill(String(119.1 + i * 0.01));
  }
  await page
    .locator("summary")
    .filter({ hasText: "Transport, destination assets & location" })
    .click();
  await page.getByLabel("Latitude", { exact: true }).last().fill("10.05");
  await page.getByLabel("Longitude", { exact: true }).last().fill("119.05");
  await page
    .getByLabel("Add areas", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Add categories", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Add facilities & features", { exact: true })
    .selectOption("Food");
  await audit(page, "place-editor");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/places/") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).id;
  places.push(id);
  const detail = await service
    .from("place_details")
    .select("access_points,latitude,longitude")
    .eq("place_id", id)
    .single();
  expect(detail.data!.access_points).toHaveLength(2);
  expect(Number(detail.data!.latitude)).toBe(10.05);
  await page.goto(`/place/${prefix}-place/`);
  await expect(
    page.getByRole("heading", { name: "Getting there: access points" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Synthetic dock in Maps" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Synthetic trail in Maps" }),
  ).toBeVisible();
  await audit(page, "access-map");
});
test("Place traveler targeting and nearby recommendations persist through editing", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await login(context);
  await page.goto("/admin/?section=places");
  await page
    .getByRole("button", { name: "Add Place", exact: true })
    .first()
    .click();
  const title = prefix + " nearby";
  const slug = prefix + "-nearby";
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("Recommendation audience").selectOption("selected");
  const audience = page.locator(".traveler-targeting");
  await audience.getByRole("searchbox").fill("Coastal Wanderer");
  await audience.getByRole("checkbox", { name: /^Coastal Wanderer / }).check();
  await audience.getByRole("searchbox").fill("Brew Chaser");
  await audience.getByRole("checkbox", { name: /^Brew Chaser / }).check();
  await expect(audience.getByRole("status")).toHaveText("2 selected");
  await audience
    .getByRole("button", { name: "Clear find a traveler type" })
    .click();
  const nearby = page.locator(".nearby-editor");
  for (const name of ["Synthetic café", "Synthetic restaurant"]) {
    await nearby
      .getByRole("button", { name: "Add nearby place", exact: true })
      .click();
    const row = nearby.locator(".nearby-editor__row").last();
    await row.getByLabel("Display name").fill(name);
    await row
      .getByLabel("Type", { exact: true })
      .selectOption(name.includes("café") ? "coffee" : "food");
    await row
      .getByLabel("Google Maps place link")
      .fill(`https://www.google.com/maps/place/${encodeURIComponent(name)}/`);
    await row
      .getByLabel("Why stop here? (optional)")
      .fill("Synthetic recommendation for browser verification.");
  }
  await nearby.getByRole("button", { name: "Move up: nearby place 2" }).click();
  await expect(nearby.locator("h3").first()).toHaveText("Synthetic restaurant");
  await audit(page, "place-targeting-editor");
  const width = page.viewportSize()!.width;
  await audience.screenshot({
    path: `artifacts/browsing-expansion/after/place-audience-${width}.png`,
  });
  await nearby.screenshot({
    path: `artifacts/browsing-expansion/after/place-nearby-${width}.png`,
  });
  await page.route("**/api/admin/places/", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic save failure. Try again." }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Synthetic save failure" }),
  ).toBeVisible();
  await expect(nearby.locator("h3").first()).toHaveText("Synthetic restaurant");
  await expect(audience.getByRole("status")).toHaveText("2 selected");
  await page.unroute("**/api/admin/places/");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/places/") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).id;
  places.push(id);
  const detail = await service
    .from("place_details")
    .select("traveler_types,nearby_places")
    .eq("place_id", id)
    .single();
  expect(detail.error).toBeNull();
  expect(detail.data!.traveler_types.sort()).toEqual([
    "identity-1",
    "identity-32",
  ]);
  expect(
    detail.data!.nearby_places.map((p: { name: string }) => p.name),
  ).toEqual(["Synthetic restaurant", "Synthetic café"]);
  await page.goto(`/admin/?section=places&search=${encodeURIComponent(title)}`);
  await page
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(page.getByLabel("Recommendation audience")).toHaveValue(
    "selected",
  );
  await expect(
    page
      .locator(".traveler-targeting")
      .getByRole("checkbox", { checked: true }),
  ).toHaveCount(2);
  await expect(page.locator(".nearby-editor h3").first()).toHaveText(
    "Synthetic restaurant",
  );
  await context.clearCookies();
  await page.goto(`/place/${slug}/`);
  await expect(
    page.getByRole("region", { name: "Recommended nearby", exact: true }),
  ).toHaveCount(0);
  await login(context, "client_explorer_plus");
  await page.goto(`/place/${slug}/`);
  const publicNearby = page.getByRole("region", {
    name: "Recommended nearby",
    exact: true,
  });
  await expect(
    publicNearby.getByRole("heading", { name: "Synthetic restaurant" }),
  ).toBeVisible();
  await expect(
    publicNearby.getByRole("link", { name: "Open in Google Maps" }),
  ).toHaveCount(2);
  await expect(
    publicNearby.getByRole("link", { name: "Open in Google Maps" }).first(),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await publicNearby.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dock = document.querySelector<HTMLElement>(".p2-floating");
        if (!dock || getComputedStyle(dock).visibility === "hidden")
          return false;
        const r = dock.getBoundingClientRect();
        return [...document.querySelectorAll(".nearby-places__list > li")].some(
          (row) => {
            const c = row.getBoundingClientRect();
            return (
              c.right > r.left &&
              c.left < r.right &&
              c.bottom > r.top &&
              c.top < r.bottom
            );
          },
        );
      }),
    )
    .toBe(false);
  await audit(page, "nearby-destination");
});

test("Explorer+ creates a dated trip, extends it and preserves entered dates on error", async ({
  page,
  context,
}) => {
  const user = await login(context, "client_explorer_plus");
  await page.goto("/itineraries/");
  if (
    await page
      .getByRole("button", { name: "+ New trip", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "+ New trip", exact: true }).click();
  await page.getByLabel("Trip name", { exact: true }).fill(prefix + " trip");
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-21");
  await page.getByLabel("End date", { exact: true }).fill("2026-10-23");
  await expect(page.locator('input[name="day_count"]')).toHaveCount(0);
  await expect(page.getByText("3 days", { exact: true })).toBeVisible();
  await page.route("**/api/v1/itineraries/", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic create failure" }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(page.locator(".p2-form .p2-error")).toContainText(
    "Synthetic create failure",
  );
  await expect(page.getByLabel("Start date", { exact: true })).toHaveValue(
    "2026-10-21",
  );
  await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
    "2026-10-23",
  );
  await page.unroute("**/api/v1/itineraries/");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/itineraries/") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const result = await saved.json();
  const trip = result.data;
  trips.push(trip.id);
  expect(trip.itinerary_days).toHaveLength(3);
  expect(trip.user_id).toBe(user.id);
  await page.getByRole("button", { name: "+ Add day", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await service
        .from("itineraries")
        .select("end_date")
        .eq("id", trip.id)
        .single();
      return r.data?.end_date;
    })
    .toBe("2026-10-24");
  await audit(page, "planner");
});
