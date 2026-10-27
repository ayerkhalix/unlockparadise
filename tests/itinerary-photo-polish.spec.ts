import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { signIn } from "./helpers/demo-session";
import type { Trip, TravelPlace } from "../src/lib/planning";
import type { ItineraryLibraryResult } from "../src/lib/itinerary-library";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };
const owned = new WeakMap<BrowserContext, { id: string; title: string }>();
test.use({ actionTimeout: 20000, navigationTimeout: 45000 });
test.afterEach(async ({ context }) => {
  const fixture = owned.get(context);
  if (!fixture) return;
  const result = await context.request.get(
    `${base}/api/v1/itineraries/${fixture.id}/`,
  );
  expect(result.ok()).toBe(true);
  const trip: Trip = (await result.json()).data;
  expect(trip.title).toBe(fixture.title);
  expect(
    (
      await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
        headers,
        data: { version: trip.version },
      })
    ).ok(),
  ).toBe(true);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
});

test("all unique destination covers crossfade every two seconds without controls or layout shift, respecting reduced motion", async ({
  page,
  context,
}, info) => {
  test.setTimeout(150000);
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?search=Tagkawayan`,
      )
    ).json()
  ).data[0];
  const title = `[TEST] Crossfade ${randomUUID().slice(0, 8)}`;
  const made = await context.request.post(`${base}/api/v1/itineraries/`, {
    headers,
    data: {
      title,
      area_id: place.areaIds![0],
      day_count: 2,
      start_date: null,
      end_date: null,
      notes: "Temporary photo verification",
    },
  });
  expect(made.ok()).toBe(true);
  let trip: Trip = (await made.json()).data;
  owned.set(context, { id: trip.id, title });
  const catalog: TravelPlace[] = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?trip=${trip.id}`,
      )
    ).json()
  ).data;
  const other = catalog.find((p) => p.image && p.image !== place.image)!;
  expect(other).toBeTruthy();
  // Insert the later day first, then repeat a destination on that day.
  for (const [day, destination] of [
    [1, other],
    [0, place],
    [1, place],
  ] as const) {
    const result = await context.request.patch(
      `${base}/api/v1/itineraries/${trip.id}/`,
      {
        headers,
        data: {
          version: trip.version,
          action: "add",
          payload: {
            day_id: trip.itinerary_days[day].id,
            place_id: destination.id,
          },
        },
      },
    );
    expect(result.ok()).toBe(true);
    trip = (await result.json()).data;
  }
  const summaryResponse = await context.request.get(
    `${base}/api/v1/itineraries/library/?q=${encodeURIComponent(title)}`,
  );
  expect(summaryResponse.ok()).toBe(true);
  const summary: ItineraryLibraryResult = await summaryResponse.json();
  expect(summary.data[0].images).toEqual([place.image, other.image]);
  expect(summary.data[0].stop_count).toBe(3);
  await page.clock.install();
  await page.goto(`/itineraries/?q=${encodeURIComponent(title)}`);
  const card = page.locator(".itinerary-library-card");
  await expect(card).toHaveAttribute("data-photo-count", "2");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-playing", "true");
  await expect
    .poll(() =>
      card
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const active = () =>
    card.locator("[data-current-photo='true'] img").getAttribute("src");
  const before = await active();
  const box = await card.boundingBox();
  await page.clock.fastForward(2100);
  await expect.poll(active).not.toBe(before);
  await expect(card.locator(".is-crossfading")).toHaveCount(1);
  const afterBox = await card.boundingBox();
  expect(afterBox!.height).toBeCloseTo(box!.height, 0);
  expect(afterBox!.width).toBeCloseTo(box!.width, 0);
  await expect(card.getByRole("button")).toHaveCount(0);
  await page.clock.fastForward(2100);
  await expect.poll(active).toBe(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(card).toHaveAttribute("data-playing", "false");
  const still = await active();
  await page.clock.fastForward(15000);
  expect(await active()).toBe(still);
  await expect(card.locator("button")).not.toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".itinerary-library").analyze())
      .violations,
  ).toEqual([]);
  await page.goto(`/itineraries/?trip=${trip.id}`);
  const field = page.getByRole("searchbox", {
    name: "Search destinations",
    exact: true,
  });
  await field.scrollIntoViewIfNeeded();
  const spacing = await field.evaluate((el) => {
    const input = el.getBoundingClientRect();
    const icon = el
      .closest("label")!
      .querySelector("svg")!
      .getBoundingClientRect();
    return input.x + parseFloat(getComputedStyle(el).paddingLeft) - icon.right;
  });
  expect(spacing).toBeGreaterThanOrEqual(10);
  await mkdir("artifacts/itinerary-photo-polish", { recursive: true });
  await page.locator(".p2-destination-choices").screenshot({
    path: `artifacts/itinerary-photo-polish/search-${info.project.name}.png`,
    animations: "disabled",
  });
});

test("profile divider spacing and sidebar Account settings link", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(context, "explorerplus2@paradise.com");
  await page.goto("/account/");
  const membership = page.locator(".p3-profile-membership");
  const settings = membership.getByRole("link", {
    name: "Account settings",
    exact: true,
  });
  await expect(settings).toHaveAttribute("href", "#account-settings");
  await expect
    .poll(() =>
      membership.evaluate(
        (el) =>
          parseFloat(
            getComputedStyle(el.closest(".p3-profile-workspace")!).paddingTop,
          ) || 0,
      ),
    )
    .toBeGreaterThanOrEqual(24);
  await expect
    .poll(() =>
      membership.evaluate(
        (el) => parseFloat(getComputedStyle(el).paddingBottom) || 0,
      ),
    )
    .toBeGreaterThanOrEqual(28);
  await mkdir("artifacts/itinerary-photo-polish", { recursive: true });
  await page.screenshot({
    path: `artifacts/itinerary-photo-polish/profile-${info.project.name}.png`,
    animations: "disabled",
  });
  await settings.click();
  await expect(page).toHaveURL(/#account-settings$/);
  await expect(page.locator("#account-settings h2")).toBeInViewport();
  await page
    .locator("#account-settings summary")
    .filter({ hasText: "Password" })
    .click();
  const password = page.locator("#profile-current-password");
  await page
    .getByRole("button", { name: "Show current password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide current password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  expect(errors.filter((message) => /hydration/i.test(message))).toEqual([]);
});
