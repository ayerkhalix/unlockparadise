import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { signIn } from "./helpers/demo-session";
import type { Trip, TravelPlace } from "../src/lib/planning";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };

test("Explore options returns to a middle beach card after browser Back and Return", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180000);
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?search=Tagkawayan`,
      )
    ).json()
  ).data[0];
  const title = `[TEST] Explore return ${randomUUID().slice(0, 8)}`;
  const made = await context.request.post(`${base}/api/v1/itineraries/`, {
    headers,
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
  const trip: Trip = (await made.json()).data;
  try {
    await page.goto(
      `/itineraries/explore/?trip=${trip.id}&day=${trip.itinerary_days[1].id}`,
    );
    await page.getByRole("button", { name: "Beaches", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Sort by", exact: true })
      .selectOption("date");
    await expect(page).toHaveURL(/sort=date/);
    await expect(
      page.locator(".planner-destination-card").first(),
    ).toBeVisible();
    const source = page.url();
    const count = await page.locator(".planner-destination-card").count();
    expect(count).toBeGreaterThan(6);
    const middle = Math.floor(count / 2);
    const href = await page
      .locator(".planner-destination-card a.upd-card__link")
      .nth(middle)
      .getAttribute("href");
    const path = new URL(href!, base).pathname;
    for (const mode of [
      "browser",
      "return",
      "manual-history",
      "cached-page",
    ] as const) {
      const link = page.locator(
        `.planner-destination-card a.upd-card__link[href^="${path}"]`,
      );
      await link.scrollIntoViewIfNeeded();
      if (mode === "manual-history")
        await page.evaluate(() => {
          history.scrollRestoration = "manual";
        });
      await link.locator("h2").click();
      await expect(page).toHaveURL(/\/place\//);
      const saved = await page.evaluate(
        (source) =>
          JSON.parse(
            sessionStorage.getItem(
              `upd:browse-position:${new URL(source).pathname + new URL(source).search}`,
            ) || "null",
          ),
        source,
      );
      expect(saved?.y).toBeGreaterThan(500);
      if (mode === "return")
        await page.getByRole("link", { name: "‹ Return", exact: true }).click();
      else await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(source);
      await expect(
        page.getByRole("button", { name: "Beaches", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("combobox", { name: "Itinerary day", exact: true }),
      ).toHaveValue(trip.itinerary_days[1].id);
      await expect(
        page.getByRole("combobox", { name: "Sort by", exact: true }),
      ).toHaveValue("date");
      await expect
        .poll(async () => {
          const rect = await page
            .locator(
              `.planner-destination-card a.upd-card__link[href^="${path}"]`,
            )
            .boundingBox();
          return rect ? Math.abs(rect.y - saved.top) : 99999;
        })
        .toBeLessThan(12);
      if (mode === "cached-page") {
        // A cached return retains listeners previously cancelled by user scrolling.
        await page.evaluate(() => {
          window.dispatchEvent(new WheelEvent("wheel"));
          window.scrollTo({ top: 0, behavior: "instant" });
          window.dispatchEvent(
            new PageTransitionEvent("pageshow", { persisted: true }),
          );
        });
        await expect
          .poll(async () => {
            const rect = await page
              .locator(
                `.planner-destination-card a.upd-card__link[href^="${path}"]`,
              )
              .boundingBox();
            return rect ? Math.abs(rect.y - saved.top) : 99999;
          })
          .toBeLessThan(12);
      }
      await page.waitForTimeout(600);
      const after = await page
        .locator(`.planner-destination-card a.upd-card__link[href^="${path}"]`)
        .boundingBox();
      expect(Math.abs(after!.y - saved.top)).toBeLessThan(12);
      await mkdir("artifacts/explore-return", { recursive: true });
      await page.screenshot({
        path: `artifacts/explore-return/${info.project.name}-${mode}.png`,
        animations: "disabled",
      });
    }
  } finally {
    const latest: Trip = (
      await (
        await context.request.get(`${base}/api/v1/itineraries/${trip.id}/`)
      ).json()
    ).data;
    expect(latest.title).toBe(title);
    expect(
      (
        await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
          headers,
          data: { version: latest.version },
        })
      ).ok(),
    ).toBe(true);
  }
});
