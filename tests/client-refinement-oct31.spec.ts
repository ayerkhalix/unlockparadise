import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/demo-session";
import { mkdir } from "node:fs/promises";
import type { Trip, TravelPlace } from "../src/lib/planning";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
test.beforeEach(async ({ page, context }) => {
  await mkdir("artifacts/client-refinement", { recursive: true });
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await signIn(context, "explorerplus2@paradise.com");
});

test("portfolio copy, quiet tabs, navigation order and checkout identity follow the client refinements", async ({
  page,
}) => {
  await page.route("**/api/v1/portfolio/**", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/v1/bucketlist/**", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.goto("/portfolio/");
  await expect(
    page.getByRole("heading", { name: "Build up your portfolio" }),
  ).toBeVisible();
  await expect(page.locator(".p2-empty p")).toHaveCount(0);
  await expect(
    page
      .locator(".p2-saved-heading")
      .getByRole("link", { name: /Itinerary Planner/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Find destinations to add", exact: true }),
  ).toHaveAttribute("href", "/#palawan-map");
  await page.screenshot({
    path: `artifacts/client-refinement/${test.info().project.name}-portfolio.png`,
  });
  expect(
    await page
      .locator('.p2-tabs a[aria-current="page"]')
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  await page.goto("/bucketlist/");
  await expect(
    page.getByText("Discover · unlock · claim", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start unlocking", exact: true }),
  ).toBeVisible();
  const nav = await page
    .getByRole("navigation", { name: "Primary", includeHidden: true })
    .getByRole("link", { includeHidden: true })
    .allTextContents();
  expect(nav.indexOf("Contact Us")).toBeLessThan(nav.indexOf("Merch"));
  await page.goto("/checkout/");
  const identity = page.locator(".p3-membership-form > .p3-checkout-identity");
  await expect(
    identity.getByText("Signed in as", { exact: true }),
  ).toBeVisible();
  const button = page.getByRole("button", {
    name: "Continue to payment",
    exact: true,
  });
  expect(
    await identity.evaluate((e) => e.nextElementSibling?.textContent?.trim()),
  ).toBe("Continue to payment");
  await expect(button).toBeVisible();
  await page.screenshot({
    path: `artifacts/client-refinement/${test.info().project.name}-checkout.png`,
  });
  await expect(page.getByText(/No automatic renewal/i)).toHaveCount(0);
});

test("one save persists all edited stops, preserves failed drafts, and saves before Explore options", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const catalog: TravelPlace[] = (
    await (await context.request.get("/api/v1/planning-places/")).json()
  ).data;
  const first = catalog.find(
    (p) =>
      p.images &&
      p.images.length > 1 &&
      p.areaIds?.length &&
      !/^(\[TEST\]|browsing-)/i.test(p.title),
  )!;
  expect(first).toBeTruthy();
  const area = first.areaIds![0];
  const second = catalog.find(
    (p) =>
      p.id !== first.id &&
      p.areaIds?.includes(area) &&
      !/^(\[TEST\]|browsing-)/i.test(p.title),
  )!;
  const title = `[TEST] Client refinements ${Date.now()}`;
  const headers = { Origin: base };
  const created = await context.request.post("/api/v1/itineraries/", {
    headers,
    data: {
      title,
      notes: "",
      start_date: null,
      end_date: null,
      day_count: 2,
      area_id: area,
    },
  });
  expect(created.ok()).toBe(true);
  let trip: Trip = (await created.json()).data;
  const endpoint = `/api/v1/itineraries/${trip.id}/`;
  try {
    for (const place of [first, second]) {
      const added = await context.request.patch(endpoint, {
        headers,
        data: {
          version: trip.version,
          action: "add",
          payload: { day_id: trip.itinerary_days[0].id, place_id: place.id },
        },
      });
      expect(added.ok()).toBe(true);
      trip = (await added.json()).data;
    }
    await page.goto(`/itineraries/?trip=${trip.id}`);
    const stops = page.locator(".p2-stops > li");
    await expect(stops).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Save time", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save note", exact: true }),
    ).toHaveCount(0);
    await stops.nth(0).getByRole("textbox").fill("Bring water");
    await stops.nth(1).getByRole("textbox").fill("Pack a towel");
    await stops.nth(0).locator(".p3-stop-timing summary").click();
    await stops
      .nth(0)
      .getByLabel("Start hour", { exact: true })
      .selectOption("8");
    await stops
      .nth(0)
      .getByLabel("End hour", { exact: true })
      .selectOption("9");
    let fail = true;
    await page.route(`**${endpoint}`, (route) => {
      if (
        route.request().method() === "PATCH" &&
        route.request().postDataJSON().action === "save_changes" &&
        fail
      ) {
        fail = false;
        return route.fulfill({
          status: 503,
          json: { error: "Temporary save failure. Try again." },
        });
      }
      return route.continue();
    });
    const save = page.getByRole("button", {
      name: "Save changes",
      exact: true,
    });
    await save.click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Temporary save failure" })
        .first(),
    ).toBeVisible();
    await expect(stops.nth(0).getByRole("textbox")).toHaveValue("Bring water");
    const unchanged: Trip = (await (await context.request.get(endpoint)).json())
      .data;
    expect(unchanged.items.every((i) => !i.notes)).toBe(true);
    await save.click();
    await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
    trip = (await (await context.request.get(endpoint)).json()).data;
    expect(trip.items.find((i) => i.place_id === first.id)?.notes).toBe(
      "Bring water",
    );
    expect(trip.items.find((i) => i.place_id === first.id)?.start_time).toMatch(
      /^08:00/,
    );
    expect(trip.items.find((i) => i.place_id === second.id)?.notes).toBe(
      "Pack a towel",
    );
    await page.screenshot({
      path: `artifacts/client-refinement/${test.info().project.name}-planner.png`,
    });
    await stops.nth(1).getByRole("textbox").fill("Pack a towel and sunblock");
    await page
      .getByRole("button", { name: "Explore options", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "Save changes before exploring destinations?",
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(stops.nth(1).getByRole("textbox")).toHaveValue(
      "Pack a towel and sunblock",
    );
    await page
      .getByRole("button", { name: "Explore options", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/itineraries\/explore\//);
    const filters = page.getByLabel("Destination filters");
    await expect(filters.locator(".planner-assets legend")).toHaveText(
      "Assets",
    );
    await expect(filters.getByRole("combobox")).toHaveCount(0);
    await expect(
      filters.getByRole("button", { name: "Explorer+", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/client-refinement/${test.info().project.name}-explore.png`,
    });
    // The carousel keeps a single destination link; navigation controls sit outside it.
    const card = page
      .locator(
        ".planner-destination-card:has(.destination-card-photos__frame:nth-child(2))",
      )
      .first();
    await expect(card).toBeVisible();
    await expect(card.locator("a.upd-card__link")).toHaveCount(1);
    const track = card.locator(".destination-card-photos__track");
    await card.getByRole("button", { name: /Next photo of/ }).click();
    await expect
      .poll(() => track.evaluate((e) => e.scrollLeft))
      .toBeGreaterThan(100);
    const current = page.url();
    await card.locator("a.upd-card__link").focus();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(() => track.evaluate((e) => e.scrollLeft))
      .toBeLessThan(3);
    expect(page.url()).toBe(current);
    const assetButton = filters.locator(".planner-assets button").first();
    await assetButton.click();
    await expect(assetButton).toHaveAttribute("aria-pressed", "true");
    const selectedAsset = new URL(page.url()).searchParams.get("assets")!;
    const selectedCategory = await page
      .locator('.planner-category-tabs button[aria-pressed="true"]')
      .innerText();
    const expected = catalog.filter(
      (p) =>
        p.areaIds?.includes(area) &&
        p.category.split(" · ").includes(selectedCategory) &&
        p.assets?.includes(selectedAsset),
    );
    await expect(page.locator(".planner-destination-card")).toHaveCount(
      expected.length,
    );
    await filters
      .getByRole("button", { name: "Reset destination filters", exact: true })
      .click();
    await expect(assetButton).toHaveAttribute("aria-pressed", "false");
    expect(new URL(page.url()).searchParams.has("assets")).toBe(false);
    await page
      .getByRole("link", { name: "View itinerary", exact: true })
      .click();
    await expect(page.locator(".p2-stops textarea").nth(1)).toHaveValue(
      "Pack a towel and sunblock",
    );
    for (const view of ["Itinerary", "Schedule", "My route"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      const gap = await page.locator(".p2-planner--focused").evaluate((e) => {
        const finder = document.querySelector(".p2-destination-finder")!;
        return (
          finder.getBoundingClientRect().top - e.getBoundingClientRect().bottom
        );
      });
      expect(gap).toBeGreaterThanOrEqual(15);
      expect(gap).toBeLessThanOrEqual(25);
    }
  } finally {
    const latest: Trip = (await (await context.request.get(endpoint)).json())
      .data;
    if (latest?.title !== title) throw Error("Test cleanup title mismatch");
    const removed = await context.request.delete(endpoint, {
      headers,
      data: { version: latest.version },
    });
    expect(removed.ok()).toBe(true);
  }
});

test("gallery API image links open as fitted images rather than embedded pages", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const catalog: TravelPlace[] = (
    await (await context.request.get("/api/v1/planning-places/")).json()
  ).data;
  const place = catalog.find(
    (p) =>
      (p.images?.length || 0) > 1 && !/^(\[TEST\]|browsing-)/i.test(p.title),
  )!;
  expect(place).toBeTruthy();
  await page.goto(`/place/${place.slug}/`);
  const gallery = page.locator(".upd-gallery");
  await expect(gallery).toHaveAttribute("data-gallery-ready", "true");
  const link = gallery.locator(".upd-gallery__slide-link").first();
  await expect(link).toHaveAttribute("data-type", "image");
  await link.click();
  const photo = page.locator(".gslide-image img").first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((e: HTMLImageElement) => e.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: `artifacts/client-refinement/${test.info().project.name}-gallery.png`,
    animations: "disabled",
  });
  await expect(page.locator(".gslide iframe")).toHaveCount(0);
  const fit = await photo.evaluate((e: HTMLImageElement) => ({
    width: e.getBoundingClientRect().width,
    height: e.getBoundingClientRect().height,
    viewport: [innerWidth, innerHeight],
  }));
  expect(fit.width).toBeLessThanOrEqual(fit.viewport[0] + 1);
  expect(fit.height).toBeLessThanOrEqual(fit.viewport[1] * 0.86);
  const ratio = await photo.evaluate((e: HTMLImageElement) => ({
    source: e.naturalWidth / e.naturalHeight,
    shown: e.getBoundingClientRect().width / e.getBoundingClientRect().height,
  }));
  expect(Math.abs(ratio.source - ratio.shown)).toBeLessThan(0.02);
  await page.keyboard.press("Escape");
  await expect(photo).toHaveCount(0);
});
