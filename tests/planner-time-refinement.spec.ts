import { setVisitTime } from "./helpers/visit-time";
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { stagingIdentity } from "./helpers/staging-auth";
import type { Trip } from "../src/lib/planning";
const base = "http://127.0.0.1:3000";
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir("artifacts/member-refinement/after", { recursive: true });
  await page.screenshot({
    path: `artifacts/member-refinement/after/${name}-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
}
test("selected planner days, timed visits and refined profile persist on staging", async ({
  page,
  context,
}) => {
  const identity = await stagingIdentity(context, "premium");
  let trip: Trip | undefined;
  try {
    await page.goto("/account/");
    await expect(
      page.getByRole("heading", { name: "Your membership", exact: true }),
    ).toBeVisible();
    await capture(page, "profile");
    const created = await context.request.post("/api/v1/itineraries/", {
      headers: { Origin: base },
      data: {
        title: "[TEST] Timed Palawan visits",
        notes: "",
        start_date: "2026-10-28",
        end_date: "2026-10-29",
        day_count: 2,
      },
    });
    expect(created.ok()).toBe(true);
    trip = (await created.json()).data;
    await page.goto(
      `/itineraries/?trip=${trip!.id}&day=${trip!.itinerary_days[0].id}`,
    );
    const days = page.getByRole("navigation", { name: "Itinerary days" });
    const first = days.getByRole("button", { name: /^Day 1/ });
    const second = days.getByRole("button", { name: /^Day 2/ });
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(first).toHaveCSS("background-color", "rgb(131, 217, 198)");
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await first.click();
    const finder = page.locator("#find-destinations");
    await finder
      .getByRole("button", { name: "Search destination", exact: true })
      .click();
    await finder.locator("button[data-place-choice]").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await setVisitTime(dialog, "Start", "08:00");
    await setVisitTime(dialog, "End", "12:00");
    await dialog
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const timing = page.locator(".p3-stop-timing").first();
    await expect(timing.locator("summary")).toContainText(
      "8:00 AM – 12:00 PM · 4h",
    );
    const stop = page.locator(".p2-stop").first();
    const notes = stop.getByLabel("Notes for this stop", { exact: true });
    await expect(notes).toBeVisible();
    await expect(notes).toBeVisible();
    const timeBox = await timing.boundingBox();
    const stopBody = await stop.locator(".p2-stop-body").boundingBox();
    expect(
      Math.abs(timeBox!.x + timeBox!.width - stopBody!.x - stopBody!.width),
    ).toBeLessThanOrEqual(2);
    await expect(timing.locator("summary")).toHaveCSS(
      "font-size",
      await stop.locator("h3").evaluate((el) => getComputedStyle(el).fontSize),
    );
    expect(timeBox!.y).toBeGreaterThanOrEqual(stopBody!.y);
    await notes.fill("Bring water and a camera.");
    const [noteSaved] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/itineraries/") &&
          response.request().method() === "PATCH" &&
          response.request().postDataJSON()?.action === "notes",
      ),
      stop.getByRole("button", { name: "Save note", exact: true }).click(),
    ]);
    expect(noteSaved.ok()).toBe(true);
    await expect(page.locator(".p2-fieldset:has(.p2-stops)")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(
      stop.getByRole("button", { name: "Save note", exact: true }),
    ).toBeDisabled();
    await page.reload();
    await expect(notes).toHaveValue("Bring water and a camera.");
    await expect(timing.locator("summary")).toContainText(
      "8:00 AM – 12:00 PM · 4h",
    );
    await timing.locator("summary").click();
    await notes.fill("Unsaved reminder");
    await second.click();
    const confirm = page.getByRole("dialog", {
      name: "Confirm action",
      exact: true,
    });
    await expect(confirm).toContainText("Discard unsaved stop notes or times");
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(notes).toHaveValue("Unsaved reminder");
    await notes.fill("Bring water and a camera.");
    await setVisitTime(timing, "End", "13:30");
    await timing
      .getByRole("button", { name: "Save time", exact: true })
      .click();
    await expect(timing.locator("summary")).toContainText("5h 30m");
    await timing.locator("summary").click();
    await expect(
      finder.locator("button[data-place-choice]").first(),
    ).toBeVisible();
    await capture(page, "planner-timed-day");
    await page
      .getByRole("group", { name: "Planner view" })
      .getByRole("button", { name: "My route", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "My route", exact: true }),
    ).toBeVisible();
    await capture(page, "planner-my-route");
  } finally {
    if (trip) {
      const current = await context.request.get(
        `/api/v1/itineraries/${trip.id}/`,
      );
      if (current.ok()) {
        const latest = (await current.json()).data;
        expect(
          (
            await context.request.delete(`/api/v1/itineraries/${trip.id}/`, {
              headers: { Origin: base },
              data: { version: latest.version },
            })
          ).ok(),
        ).toBe(true);
      }
    }
    await identity.db.auth.signOut({ scope: "local" });
  }
});
