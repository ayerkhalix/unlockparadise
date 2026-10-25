import { test, expect, type BrowserContext } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { signIn } from "./helpers/demo-session";
import { setVisitTime } from "./helpers/visit-time";
import type { TravelPlace, Trip } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };
const cleanup = new WeakMap<BrowserContext, () => Promise<void>>();
test.afterEach(async ({ context }) => {
  await cleanup.get(context)?.();
  cleanup.delete(context);
});

test("visit times stay editable through hour, minute and AM/PM changes, validation and reload", async ({
  page,
  context,
  browserName,
}, info) => {
  test.setTimeout(90000);
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        base + "/api/v1/planning-places/?search=Tagkawayan",
        { timeout: 15000, maxRetries: 2 },
      )
    ).json()
  ).data[0];
  const title = `[TEST] Safari time ${randomUUID().slice(0, 8)}`;
  const made = await context.request.post(base + "/api/v1/itineraries/", {
    headers,
    data: {
      title,
      notes: "",
      area_id: place.areaIds![0],
      day_count: 2,
      start_date: null,
      end_date: null,
    },
    timeout: 15000,
  });
  expect(made.ok()).toBe(true);
  const trip: Trip = (await made.json()).data;
  cleanup.set(context, async () => {
    const latest = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
      { timeout: 15000, maxRetries: 2 },
    );
    if (latest.status() === 404) return;
    expect(latest.ok()).toBe(true);
    const saved: Trip = (await latest.json()).data;
    expect(saved.title).toBe(title);
    expect(
      (
        await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
          headers,
          data: { version: saved.version },
          timeout: 15000,
        })
      ).ok(),
    ).toBe(true);
  });
  const currentTrip = async (): Promise<Trip> =>
    (
      await (
        await context.request.get(`${base}/api/v1/itineraries/${trip.id}/`, {
          maxRetries: 2,
          timeout: 15000,
        })
      ).json()
    ).data;
  await page.goto(`/itineraries/?trip=${trip.id}`);
  await page
    .getByRole("button", { name: "Search destination", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search destinations", exact: true })
    .fill(place.title);
  await page.locator("button[data-place-choice]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", { name: "Start minute", exact: true }),
  ).toBeDisabled();
  const startHour = dialog.getByRole("combobox", {
    name: "Start hour",
    exact: true,
  });
  await startHour.selectOption("8");
  await startHour.focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("combobox", { name: "Start minute", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("combobox", { name: "Start minute", exact: true })
    .selectOption("22");
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("combobox", { name: "Start AM/PM", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("combobox", { name: "Start AM/PM", exact: true })
    .selectOption("PM");
  await dialog
    .getByRole("combobox", { name: "Start AM/PM", exact: true })
    .selectOption("AM");
  await expect(startHour).toHaveValue("8");
  await expect(
    dialog.getByRole("combobox", { name: "Start minute", exact: true }),
  ).toHaveValue("22");
  await setVisitTime(dialog, "End", "07:00");
  await dialog.getByRole("button", { name: "Add Place", exact: true }).click();
  await expect(
    dialog.getByRole("combobox", { name: "End hour", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect((await currentTrip()).items).toHaveLength(0);
  await setVisitTime(dialog, "End", "10:47");
  await expect(dialog.locator(".p2-field-error,.p2-form-summary")).toHaveCount(
    0,
  );
  await expect(dialog.locator(".p3-time-preview")).toContainText("2h 25m");
  await mkdir("artifacts/safari-time", { recursive: true });
  await page.screenshot({
    path: `artifacts/safari-time/add-${info.project.name}.png`,
    animations: "disabled",
  });
  expect(
    (await new AxeBuilder({ page }).include(".p2-modal").analyze()).violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Add Place", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  let saved = await currentTrip();
  expect(saved.items[0].start_time?.slice(0, 5)).toBe("08:22");
  expect(saved.items[0].end_time?.slice(0, 5)).toBe("10:47");
  const timing = page.locator(".p3-stop-timing").first();
  await timing.locator("summary").click();
  await setVisitTime(timing, "Start", "00:00");
  await setVisitTime(timing, "End", "12:00");
  await timing.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
  saved = await currentTrip();
  expect(saved.items[0].start_time?.slice(0, 5)).toBe("00:00");
  expect(saved.items[0].end_time?.slice(0, 5)).toBe("12:00");
  await page.reload();
  await timing.locator("summary").click();
  await expect(
    timing.getByRole("combobox", { name: "Start hour", exact: true }),
  ).toHaveValue("12");
  await expect(
    timing.getByRole("combobox", { name: "Start AM/PM", exact: true }),
  ).toHaveValue("AM");
  await expect(
    timing.getByRole("combobox", { name: "End AM/PM", exact: true }),
  ).toHaveValue("PM");
  await timing
    .getByRole("combobox", { name: "End minute", exact: true })
    .selectOption("59");
  await timing.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
  await timing.locator("summary").click();
  await timing
    .getByRole("button", { name: "Clear times", exact: true })
    .click();
  await timing.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
  saved = await currentTrip();
  expect(saved.items[0].start_time).toBeNull();
  expect(saved.items[0].end_time).toBeNull();
  await page.goto(
    `/itineraries/explore/?trip=${trip.id}&day=${trip.itinerary_days[1].id}&category=${encodeURIComponent(place.category.split(" · ")[0])}&shown=1000`,
  );
  await page
    .locator(".planner-destination-card")
    .filter({ hasText: place.title })
    .getByRole("button", { name: "Add to itinerary", exact: true })
    .click();
  await setVisitTime(dialog, "Start", "13:15");
  await setVisitTime(dialog, "End", "15:30");
  await dialog
    .getByRole("button", { name: "Add destination", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  saved = await currentTrip();
  const second = saved.items.find(
    (item) => item.day_id === trip.itinerary_days[1].id,
  )!;
  expect(second.start_time?.slice(0, 5)).toBe("13:15");
  expect(second.end_time?.slice(0, 5)).toBe("15:30");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(["chromium", "webkit"]).toContain(browserName);
});
