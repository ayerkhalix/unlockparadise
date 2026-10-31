import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { signIn } from "./helpers/demo-session";
import type { Trip, TravelPlace } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const output = "artifacts/client-document-review";
test.beforeEach(async ({ page, context }) => {
  await mkdir(output, { recursive: true });
  await signIn(context, "explorerplus2@paradise.com");
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
});
test("checkout choices lead, saved tabs stay white, empty cards are compact and Vision fades", async ({
  page,
}) => {
  await page.route("**/api/v1/portfolio/**", (r) =>
    r.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/v1/bucketlist/**", (r) =>
    r.fulfill({ json: { data: [] } }),
  );
  await page.goto("/portfolio/");
  const empty = page.locator(".p2-empty");
  await expect(empty).toContainText("Build up your portfolio");
  const colors = await page
    .locator(".p2-tabs a")
    .evaluateAll((es) => es.map((e) => getComputedStyle(e).color));
  expect(colors[0]).toEqual(colors[1]);
  expect((await empty.boundingBox())!.height).toBeLessThan(200);
  await page.screenshot({
    path: `${output}/${test.info().project.name}-portfolio.png`,
    animations: "disabled",
  });
  await page.goto("/bucketlist/");
  await expect(empty).toContainText("Start unlocking");
  expect((await empty.boundingBox())!.height).toBeLessThan(310);
  await page.goto("/checkout/");
  const choices = page.locator(".p3-membership-plans");
  await expect(choices.getByText("One year", { exact: true })).toBeVisible();
  const plan = await choices.boundingBox(),
    benefits = await page.locator(".p3-checkout-benefits").boundingBox();
  if (
    test.info().project.name.includes("mobile") ||
    test.info().project.name.includes("phone")
  ) {
    expect(plan!.y + plan!.height).toBeLessThan(page.viewportSize()!.height);
    expect(benefits!.y).toBeGreaterThan(plan!.y + plan!.height);
  }
  await expect(page.locator("main")).not.toContainText(
    /\btest\b|demo accounts/i,
  );
  await expect(page.locator(".p3-checkout-preview")).toContainText(
    "No real payment is collected",
  );
  expect(
    await page
      .locator(".p3-checkout-identity")
      .evaluate((e) => e.nextElementSibling?.textContent?.trim()),
  ).toBe("Continue to payment");
  await page.screenshot({
    path: `${output}/${test.info().project.name}-checkout.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/about/");
  const picture = page.locator(".upd-about__plate").filter({
    has: page.locator(
      'img[data-image-original*="IMG_1967"],img[src*="IMG_1967"]',
    ),
  });
  await expect(picture).toHaveCount(1);
  expect(
    await picture.evaluate(
      (e) => getComputedStyle(e, "::after").backgroundImage,
    ),
  ).toContain("linear-gradient");
  await picture.scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        picture
          .locator("img")
          .evaluate((e: HTMLImageElement) => e.naturalWidth),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
  await picture.locator("img").evaluate((e: HTMLImageElement) => e.decode());
  await page.screenshot({
    path: `${output}/${test.info().project.name}-vision.png`,
    animations: "disabled",
  });
});
test("notes expand opposite the time, keep drafts and save together; destinations only appear while searching", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  const catalog: TravelPlace[] = (
    await (await context.request.get("/api/v1/planning-places/")).json()
  ).data;
  expect(
    catalog.every((p) => !/^\[TEST\]|^browsing-[a-f0-9]{6,}/i.test(p.title)),
  ).toBe(true);
  const place = catalog.find((p) => p.areaIds?.length && p.image)!;
  const title = `[TEST] Client document ${Date.now()}`;
  const headers = { Origin: base };
  const made = await context.request.post("/api/v1/itineraries/", {
    headers,
    data: {
      title,
      notes: "",
      start_date: null,
      end_date: null,
      day_count: 1,
      area_id: place.areaIds![0],
    },
  });
  expect(made.ok()).toBe(true);
  let trip: Trip = (await made.json()).data;
  const endpoint = `/api/v1/itineraries/${trip.id}/`;
  try {
    const add = await context.request.patch(endpoint, {
      headers,
      data: {
        version: trip.version,
        action: "add",
        payload: { day_id: trip.itinerary_days[0].id, place_id: place.id },
      },
    });
    expect(add.ok()).toBe(true);
    trip = (await add.json()).data;
    await page.goto(`/itineraries/?trip=${trip.id}`);
    const stop = page.locator(".p2-stops > li").first();
    const note = stop.getByRole("button", { name: "Add note", exact: true });
    await expect(note).toBeVisible();
    await expect(stop.locator("textarea")).toBeHidden();
    expect((await note.boundingBox())!.x).toBeLessThan(
      (await stop.locator(".p3-stop-timing").boundingBox())!.x,
    );
    await note.click();
    await stop.getByRole("textbox").fill("Bring water and a camera.");
    await stop.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(stop.locator("textarea")).toBeHidden();
    await expect(page.locator(".p2-search-results")).toHaveCount(0);
    const search = page.getByRole("searchbox", {
      name: "Search destinations",
      exact: true,
    });
    await search.fill(place.title);
    await expect(page.locator(".p2-search-results")).toContainText(place.title);
    await page
      .getByRole("button", { name: "Clear search destinations", exact: true })
      .click();
    await expect(page.locator(".p2-search-results")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Explore options", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Save changes before exploring destinations?",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await stop.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(stop.getByRole("textbox")).toHaveValue(
      "Bring water and a camera.",
    );
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
    trip = (await (await context.request.get(endpoint)).json()).data;
    expect(trip.items[0].notes).toBe("Bring water and a camera.");
    await page
      .getByRole("button", { name: "Dismiss notification", exact: true })
      .last()
      .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/${test.info().project.name}-planner.png`,
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    test.setTimeout(test.info().timeout + 20000);
    const latest: Trip = (await (await context.request.get(endpoint)).json())
      .data;
    if (latest.title !== title) throw Error("Fixture title mismatch");
    expect(
      (
        await context.request.delete(endpoint, {
          headers,
          data: { version: latest.version },
        })
      ).ok(),
    ).toBe(true);
  }
});
test("review cards keep their author and rating hierarchy with the heart at the far right", async ({
  page,
  context,
}) => {
  const catalog: TravelPlace[] = (
    await (await context.request.get("/api/v1/planning-places/")).json()
  ).data;
  const place = catalog.find((p) => p.rating && p.rating > 0)!;
  expect(place).toBeTruthy();
  await page.goto(`/place/${place.slug}/`);
  const review = page.locator(".upd-review").first();
  await expect(review.locator(".upd-review__avatar")).toBeVisible();
  await expect(review.locator(".upd-review__rating")).toBeVisible();
  const like = review.locator(".upd-like");
  const bounds = await review.boundingBox(),
    heart = await like.boundingBox();
  expect(heart!.x + heart!.width).toBeGreaterThan(
    bounds!.x + bounds!.width - 50,
  );
  await like.hover();
  expect((await like.boundingBox())!.x).toBeCloseTo(heart!.x, 0);
  // A provider failure cannot falsely toggle the heart or lose the review.
  const original = await like.getAttribute("aria-pressed");
  await page.route("**/api/v1/review-likes/**", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "Could not update the heart. Try again." },
    }),
  );
  await like.click();
  await expect(review.getByRole("status")).toContainText(
    "Could not update the heart",
  );
  await expect(like).toHaveAttribute("aria-pressed", original!);
  await page.unroute("**/api/v1/review-likes/**");
  await review.screenshot({
    path: `${output}/${test.info().project.name}-review.png`,
    animations: "disabled",
  });
  const photo = review.locator('img[src^="/api/avatars/"]');
  if (await photo.count()) {
    const anonymous = await context.browser()!.newContext({ baseURL: base });
    const response = await anonymous.request.get(
      (await photo.getAttribute("src"))!,
    );
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
    expect(response.headers()["location"]).toBeUndefined();
    await anonymous.close();
  }
  const invalid = await context.request.get(
    "/api/avatars/10000000-0000-4000-8000-000000000000/",
  );
  expect(invalid.status()).toBe(404);
});
