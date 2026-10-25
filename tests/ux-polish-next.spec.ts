import {
  test,
  expect,
  type Page,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { signIn } from "./helpers/demo-session";
import type { Trip, TravelPlace } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000",
  origin = { Origin: base };
async function photographicDestination(request: APIRequestContext) {
  const rows = (
    await (await request.get(base + "/api/v1/places/?limit=100")).json()
  ).data;
  const candidates = rows
    .filter(
      (row: { vip_content: boolean; preview_id?: string }) =>
        row.vip_content && row.preview_id,
    )
    .sort(
      (a: { published_at: string }, b: { published_at: string }) =>
        Date.parse(a.published_at) - Date.parse(b.published_at),
    );
  for (const row of candidates.slice(0, 12)) {
    const preview = await request.get(`${base}/api/previews/${row.id}/`);
    if (preview.ok() && (await preview.body()).length > 4096) return row;
  }
  throw new Error(
    "A published photographic destination preview is required for this visual check.",
  );
}
async function photo(page: Page, name: string) {
  await mkdir("artifacts/ux-polish", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({
    path: `artifacts/ux-polish/${name}-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function removeTrip(context: BrowserContext, id: string, title: string) {
  const r = await context.request.get(`${base}/api/v1/itineraries/${id}/`);
  if (r.ok()) {
    const trip = (await r.json()).data;
    expect(trip.title).toBe(title);
    expect(
      (
        await context.request.delete(`${base}/api/v1/itineraries/${id}/`, {
          headers: origin,
          data: { version: trip.version },
        })
      ).ok(),
    ).toBe(true);
  }
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
});

test("client corrections: passive hero icons, ready category photos and edge-to-edge featured frames", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  const chips = page.locator(".upd-hero-cats .upd-cat-chip");
  await expect(chips).toHaveCount(6);
  await expect(
    page.locator(".upd-hero-cats a, .upd-hero-cats button"),
  ).toHaveCount(0);
  await chips.first().hover();
  await expect(page.locator("#upd-tooltip")).toContainText("Beaches");
  const unchanged = page.url();
  await chips.first().click();
  expect(page.url()).toBe(unchanged);
  const featured = page.locator("#featured img.upd-fcard-img");
  await expect(featured).toHaveCount(4);
  await expect
    .poll(
      () =>
        featured.evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  for (const image of await featured.all())
    await expect(image).toHaveCSS("object-fit", "cover");
  const frame = (await featured.first().boundingBox())!;
  expect(frame.width / frame.height).toBeCloseTo(4 / 3, 1);
  await photo(page, "home-photo-composition");
  await page.locator("#featured").screenshot({
    path: `artifacts/ux-polish/featured-photos-${page.viewportSize()!.width}.png`,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Explore Puerto Princesa City", exact: true })
    .first()
    .click();
  const categories = page.locator(".p2-main-area-map .category-thumb");
  await expect(categories).toHaveCount(8);
  await expect
    .poll(
      () =>
        categories.evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
      { timeout: 45000 },
    )
    .toBe(true);
  await expect(
    page.locator(".category-btn[data-cat=beaches] img"),
  ).toHaveAttribute("loading", "eager");
  const riverAspect = await page
    .locator('.category-btn[data-cat="rivers"] img')
    .evaluate(
      (image: HTMLImageElement) => image.naturalWidth / image.naturalHeight,
    );
  expect(riverAspect).toBeCloseTo(3 / 4, 1);
  const islandAspect = await page
    .locator('.category-btn[data-cat="islands"] img')
    .evaluate(
      (image: HTMLImageElement) => image.naturalWidth / image.naturalHeight,
    );
  expect(islandAspect).toBeCloseTo(1, 1);
  await page.screenshot({
    path: `artifacts/ux-polish/category-photos-${page.viewportSize()!.width}.png`,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  const mediaSource = await page
    .locator(".category-thumb[src^='/api/media/']")
    .first()
    .getAttribute("src");
  const staticSource = await featured
    .first()
    .getAttribute("data-image-original");
  const paths = new Set([
    new URL(mediaSource!, base).pathname,
    new URL(staticSource!, base).pathname,
  ]);
  let failed = 0;
  await page.route("**/api/media/**", (route) => {
    const url = new URL(route.request().url());
    if (paths.has(url.pathname) && url.searchParams.has("width")) {
      failed++;
      return route.fulfill({
        status: 503,
        body: "Synthetic resized-photo failure",
      });
    }
    return route.continue();
  });
  await page.reload();
  await expect.poll(() => failed).toBeGreaterThan(0);
  for (const path of paths)
    await expect
      .poll(
        () =>
          page.locator("img").evaluateAll(
            (images, target) =>
              images.some((image) => {
                const photo = image as HTMLImageElement;
                const url = new URL(photo.src);
                return (
                  url.pathname === target &&
                  !url.searchParams.has("width") &&
                  photo.naturalWidth > 0
                );
              }),
            path,
          ),
        { timeout: 45000 },
      )
      .toBe(true);
});

test("client corrections: destination hooks show a photo and memberships while feature hooks omit the duplicate brand", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120000);
  const hidden = await photographicDestination(request);
  await page.goto(`/place/${hidden.id}/`);
  await expect(page.locator(".destination-gate__photo img")).toBeVisible();
  await expect
    .poll(
      () =>
        page
          .locator(".destination-gate__photo img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      { timeout: 45000 },
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".upd-plans__col")).toHaveCount(3);
  await expect(page.locator(".destination-gate")).toContainText(
    "You need an Explorer+ account",
  );
  await expect(
    page.locator(".member-lock__brand, .member-lock__symbol"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Get Explorer+", exact: true }),
  ).toHaveAttribute("href", /^\/membership\/\?return_to=/);
  await photo(page, "destination-photo-hook");
  expect(
    (await new AxeBuilder({ page }).include(".destination-gate").analyze())
      .violations,
  ).toEqual([]);
  await page.goto("/bucketlist/");
  await expect(page.locator(".member-lock__symbol")).toBeVisible();
  await expect(page.locator(".member-lock__brand")).toHaveCount(0);
  await photo(page, "feature-hook-without-logo");
  await signIn(context, "explorer2@paradise.com");
  await page.goto(`/place/${hidden.id}/`);
  await expect(page.locator(".destination-gate__photo img")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "My account", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".destination-gate h1")).toHaveText(
    "You need an Explorer+ account to view this place",
  );
});

test("accepted polish: save retry, exact Undo, safer trip menu and compact destination filters", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        base + "/api/v1/planning-places/?search=Tagkawayan",
      )
    ).json()
  ).data[0];
  const title = `[TEST] UX recovery ${randomUUID().slice(0, 8)}`;
  const made = await context.request.post(base + "/api/v1/itineraries/", {
    headers: origin,
    data: {
      title,
      notes: "",
      start_date: null,
      end_date: null,
      day_count: 2,
      area_id: place.areaIds![0],
    },
  });
  expect(made.ok()).toBe(true);
  let trip = (await made.json()).data as Trip;
  try {
    const day = trip.itinerary_days[0];
    const add = await context.request.patch(
      `${base}/api/v1/itineraries/${trip.id}/`,
      {
        headers: origin,
        data: {
          version: trip.version,
          action: "add",
          payload: {
            day_id: day.id,
            place_id: place.id,
            start_time: "08:00",
            end_time: "10:00",
          },
        },
      },
    );
    expect(add.ok()).toBe(true);
    trip = (await add.json()).data;
    await page.goto(`/itineraries/?trip=${trip.id}`);
    const status = page.locator(".p2-save-feedback");
    await expect(status).toHaveText("Saved");
    await expect(
      page.getByRole("button", { name: "Delete itinerary", exact: true }),
    ).toHaveCount(0);
    await page.locator(".p2-trip-options > summary").click();
    await expect(
      page.getByRole("button", { name: "Delete trip", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Delete trip", exact: true }),
    ).not.toBeVisible();
    const stop = page.locator(".p2-stop").first();
    const notes = stop.locator("textarea");
    await notes.fill("Bring water and leave no trace.");
    await expect(status).toHaveText("Unsaved notes or times");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true,
      failUndo = true;
    await page.route(`**/api/v1/itineraries/${trip.id}/`, async (route) => {
      if (
        route.request().method() === "PATCH" &&
        route.request().postDataJSON().action === "notes" &&
        first
      ) {
        first = false;
        await gate;
        await route.fulfill({
          status: 503,
          json: { error: "Synthetic connection failure" },
        });
      } else if (
        route.request().method() === "PATCH" &&
        route.request().postDataJSON().action === "restore" &&
        failUndo
      ) {
        failUndo = false;
        await route.fulfill({
          status: 503,
          json: { error: "Synthetic Undo connection failure" },
        });
      } else await route.continue();
    });
    await stop.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(status).toHaveText("Saving changes…");
    release();
    await expect(status).toHaveText("Changes not saved");
    await expect(notes).toHaveValue("Bring water and leave no trace.");
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await expect(status).toHaveText("Saved");
    await expect(
      stop.getByRole("button", { name: "Save note", exact: true }),
    ).toBeDisabled();
    await stop.locator(".p2-stop-actions > summary").click();
    await stop
      .getByRole("button", { name: "Remove destination", exact: true })
      .click();
    await expect(page.locator(".p2-stop")).toHaveCount(0);
    const undo = page.getByRole("button", {
      name: "Undo removal",
      exact: true,
    });
    await expect(undo).toBeVisible();
    await photo(page, "itinerary-undo");
    await undo.click();
    await expect(
      page.getByRole("button", { name: "Retry Undo removal", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry save", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Retry Undo removal", exact: true })
      .click();
    await expect(page.locator(".p2-stop")).toHaveCount(1);
    await expect(status).toHaveText("Saved");
    trip = (
      await (
        await context.request.get(`${base}/api/v1/itineraries/${trip.id}/`)
      ).json()
    ).data;
    expect(trip.items[0].notes).toBe("Bring water and leave no trace.");
    expect(trip.items[0].start_time).toBe("08:00:00");
    expect(trip.items[0].position).toBe(0);
    let show!: () => void;
    const catalog = new Promise<void>((resolve) => {
      show = resolve;
    });
    await page.route("**/api/v1/planning-places/**", async (route) => {
      await catalog;
      await route.continue();
    });
    await page.goto(`/itineraries/explore/?trip=${trip.id}&day=${day.id}`);
    await expect(page.locator(".p2-card-skeleton")).toHaveCount(6);
    await photo(page, "destination-loading");
    show();
    await expect(
      page.locator(".planner-destination-card").first(),
    ).toBeVisible();
    await photo(page, "explore-compact");
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await page.locator(".planner-filter-disclosure > summary").click();
    await page.getByRole("checkbox", { name: "Car", exact: true }).check();
    await expect(page).toHaveURL(/access=Car/);
    await page
      .getByRole("button", { name: "Clear filters (1)", exact: true })
      .click();
    await photo(page, "explore-filters");
    expect(
      (await new AxeBuilder({ page }).include(".planner-browser").analyze())
        .violations,
    ).toEqual([]);
  } finally {
    await removeTrip(context, trip.id, title);
  }
});

test("accepted polish: bucketlist and cart removals can be undone and mobile merch is compact", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await signIn(context, "explorerplus2@paradise.com");
  const before = (
    await (await context.request.get(base + "/api/v1/bucketlist/")).json()
  ).data;
  const candidates: TravelPlace[] = (
    await (await context.request.get(base + "/api/v1/planning-places/")).json()
  ).data;
  const place = candidates.find(
    (p) =>
      p.image &&
      !p.title.includes("[TEST]") &&
      !before.some(
        (row: { place_id: string; saved_at: string }) =>
          row.place_id === p.id && row.saved_at,
      ),
  )!;
  expect(place).toBeTruthy();
  try {
    expect(
      (
        await context.request.post(base + "/api/v1/bucketlist/", {
          headers: origin,
          data: { place_id: place.id, op: "save" },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/bucketlist/");
    const card = page.locator(".p2-saved-card").filter({
      has: page.getByRole("heading", { name: place.title, exact: true }),
    });
    await card
      .getByRole("button", { name: "Remove from Bucketlist", exact: true })
      .click();
    await expect(card).toHaveCount(0);
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .click();
    await expect(card).toBeVisible();
    await page.goto("/merch/");
    if (page.viewportSize()!.width < 600)
      expect(
        (await page.locator(".p2-merch-hero").boundingBox())!.height,
      ).toBeLessThan(350);
    const product = page
      .locator(".p2-product-card")
      .filter({ has: page.getByRole("button", { name: /Add to cart/ }) })
      .first();
    await expect(product).toBeVisible();
    const name = (await product.locator("h3").innerText()).trim();
    await product.locator("select").selectOption({ index: 1 });
    await product.getByRole("button", { name: /Add to cart/ }).click();
    await expect(product).toContainText("Ordering opens soon");
    await photo(page, "merch-compact");
    await page.goto("/merch/cart/");
    const quantity = page.getByRole("spinbutton", {
      name: new RegExp(
        `Quantity for ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ),
    });
    await quantity.fill("2");
    const previous = await page.evaluate(() =>
      localStorage.getItem("unlock-paradise-cart"),
    );
    await page
      .getByRole("button", {
        name: new RegExp(
          `^Remove ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`,
        ),
      })
      .click();
    await expect(quantity).toHaveCount(0);
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .click();
    await expect(quantity).toHaveValue("2");
    expect(
      await page.evaluate(() => localStorage.getItem("unlock-paradise-cart")),
    ).toBe(previous);
    await photo(page, "cart-restored");
  } finally {
    expect(
      (
        await context.request.post(base + "/api/v1/bucketlist/", {
          headers: origin,
          data: { place_id: place.id, op: "unsave" },
        })
      ).ok(),
    ).toBe(true);
  }
});

test("accepted polish: admin crop drafts, persistence, reset and failed product saves retain edits", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  await signIn(context, "unlockadmin@paradise.com");
  const media = (
    await (await context.request.get(base + "/api/admin/media/")).json()
  ).data;
  const image =
    media.find(
      (m: { id: string; status: string; bucket: string; byte_size: number }) =>
        m.status === "ready" &&
        m.bucket === "destination-public" &&
        m.byte_size > 10000,
    ) ||
    media.find(
      (m: { status: string; bucket: string }) =>
        m.status === "ready" && m.bucket === "destination-public",
    );
  expect(image).toBeTruthy();
  const token = randomUUID().slice(0, 8),
    title = `[TEST] UX crop ${token}`,
    slug = `test-ux-crop-${token}`;
  let placeId: string | undefined;
  let createdPayload: Record<string, unknown> | undefined;
  try {
    await page.goto("/admin/?section=places");
    await page
      .getByRole("button", { name: "Add Place", exact: true })
      .first()
      .click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator("summary").filter({ hasText: "Photos" }).first().click();
    await page.locator('select[name="cover_id"]').selectOption(image.id);
    const focus = page.locator(".photo-focal-editor").first();
    await focus.locator("summary").click();
    const canvas = focus.getByRole("button", { name: /Photo focal point:/ });
    await canvas.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(focus.getByRole("status")).toContainText(
      "52% across · 52% down",
    );
    await expect(focus.locator(".photo-focal-preview img")).toHaveCSS(
      "object-position",
      "52% 52%",
    );
    await photo(page, "place-focal-editor");
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/places/") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    const result = await saved;
    expect(result.ok()).toBe(true);
    createdPayload = result.request().postDataJSON();
    placeId = (await result.json()).id;
    let record = (
      await (
        await context.request.get(`${base}/api/admin/places/${placeId}/`)
      ).json()
    ).data[0];
    expect(Number(record.place_media[0].focal_x)).toBe(52);
    expect(Number(record.place_media[0].focal_y)).toBe(52);
    await page.goto(
      "/admin/?section=places&search=" + encodeURIComponent(title),
    );
    await page
      .getByRole("button", { name: `Edit ${title}`, exact: true })
      .click();
    await page.locator("summary").filter({ hasText: "Photos" }).first().click();
    const reopened = page.locator(".photo-focal-editor").first();
    await reopened.locator("summary").click();
    await expect(reopened.getByRole("status")).toContainText(
      "52% across · 52% down",
    );
    await reopened
      .getByRole("button", { name: "Reset to center", exact: true })
      .click();
    await expect(reopened.getByRole("status")).toContainText(
      "50% across · 50% down",
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Place", exact: true }),
    ).toHaveCount(0);
    record = (
      await (
        await context.request.get(`${base}/api/admin/places/${placeId}/`)
      ).json()
    ).data[0];
    expect(Number(record.place_media[0].focal_x)).toBe(50);
    await page.goto("/admin/?section=merchandise&status=publish");
    await page
      .getByRole("button", { name: /^Edit / })
      .first()
      .click();
    const productFocus = page.locator(".photo-focal-editor").first();
    await productFocus.locator("summary").click();
    const productCanvas = productFocus.getByRole("button", {
      name: /Photo focal point:/,
    });
    await expect(productCanvas).toBeEnabled();
    await productCanvas.scrollIntoViewIfNeeded();
    await productCanvas.focus();
    await expect(productCanvas).toBeFocused();
    await productCanvas.press("ArrowRight");
    await expect(productFocus.getByRole("status")).toHaveText(
      "Focus: 52% across · 50% down",
    );
    let sentFocus: unknown;
    await page.route("**/api/admin/merchandise/*/", async (route) => {
      if (route.request().method() === "PATCH") {
        sentFocus = route.request().postDataJSON().images[0].focal;
        await route.fulfill({
          status: 503,
          json: { error: "Synthetic crop save failure" },
        });
      } else await route.continue();
    });
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Synthetic crop save failure" }),
    ).toBeVisible();
    expect(sentFocus).toBeTruthy();
    await expect(productFocus.getByRole("status")).not.toHaveText(
      "Focus: 50% across · 50% down",
    );
    await photo(page, "product-focal-editor");
  } finally {
    if (placeId && createdPayload) {
      const current = (
        await (
          await context.request.get(`${base}/api/admin/places/${placeId}/`)
        ).json()
      ).data[0];
      expect(current.title).toBe(title);
      const archived = await context.request.patch(
        `${base}/api/admin/places/${placeId}/`,
        {
          headers: origin,
          data: {
            ...createdPayload,
            status: "archived",
            expected_updated_at: current.updated_at,
          },
        },
      );
      expect(archived.ok(), await archived.text()).toBe(true);
      expect(
        (
          await context.request.delete(`${base}/api/admin/places/${placeId}/`, {
            headers: origin,
            data: { confirm_slug: slug },
          })
        ).ok(),
      ).toBe(true);
    }
  }
});
