import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { signIn } from "./helpers/demo-session";
import { setVisitTime } from "./helpers/visit-time";
import { dayLabel, type Trip, type TravelPlace } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };
const cleanup = new WeakMap<BrowserContext, () => Promise<void>>();
test.afterEach(async ({ context }) => {
  await cleanup.get(context)?.();
  cleanup.delete(context);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
});
async function shot(page: Page, name: string) {
  await mkdir("artifacts/client-plan-oct26", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.images]
            .filter((img) => {
              const r = img.getBoundingClientRect();
              return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
            })
            .every((img) => img.complete),
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  if (name === "schedule") {
    await page.locator(".p2-trip-schedule").screenshot({
      path: `artifacts/client-plan-oct26/schedule-full-${page.viewportSize()!.width}.png`,
      animations: "disabled",
    });
  }
  await page.screenshot({
    path: `artifacts/client-plan-oct26/${name}-${page.viewportSize()!.width}.png`,
    animations: "disabled",
  });
}
async function fixture(context: BrowserContext) {
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?search=Tagkawayan`,
        { maxRetries: 2 },
      )
    ).json()
  ).data[0];
  const title = `[TEST] October plan ${randomUUID().slice(0, 8)}`;
  const response = await context.request.post(`${base}/api/v1/itineraries/`, {
    headers,
    data: {
      title,
      notes: "",
      area_id: place.areaIds![0],
      day_count: 4,
      start_date: "2026-12-30",
      end_date: "2027-01-02",
    },
  });
  expect(response.ok()).toBe(true);
  let trip: Trip = (await response.json()).data;
  cleanup.set(context, async () => {
    const r = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
      { timeout: 20000, maxRetries: 2 },
    );
    if (r.status() === 404) return;
    expect(r.ok()).toBe(true);
    const current: Trip = (await r.json()).data;
    expect(current.title).toBe(title);
    expect(
      (
        await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
          headers,
          data: { version: current.version },
          timeout: 20000,
        })
      ).ok(),
    ).toBe(true);
  });
  const allPlaces: TravelPlace[] = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?trip=${trip.id}`,
        { maxRetries: 2 },
      )
    ).json()
  ).data;
  const places = allPlaces.filter((p) => !p.title.startsWith("[TEST]"));
  const mutate = async (action: string, payload: unknown) => {
    const r = await context.request.patch(
      `${base}/api/v1/itineraries/${trip.id}/`,
      { headers, data: { version: trip.version, action, payload } },
    );
    expect(r.ok()).toBe(true);
    trip = (await r.json()).data;
    return trip;
  };
  return {
    get trip() {
      return trip;
    },
    places,
    allPlaces,
    place,
    mutate,
  };
}

test("whole-trip schedule, persistent search, Safari time editing and confirmed middle-day deletion", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  const f = await fixture(context);
  const originalDays = [...f.trip.itinerary_days];
  for (let n = 0; n < 3; n++)
    await f.mutate("add", {
      day_id: originalDays[n].id,
      place_id: f.places[n].id,
      ...(n < 2 ? { start_time: "08:15", end_time: "10:45" } : {}),
    });
  const noted = f.trip.items.find((i) => i.day_id === originalDays[1].id)!;
  await f.mutate("notes", {
    item_id: noted.id,
    notes: "Pack water and a dry bag.",
  });
  await page.goto(`/itineraries/?trip=${f.trip.id}`);
  await expect(
    page.getByRole("searchbox", { name: "Search destinations", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".p2-search-results > li")).toHaveCount(
    f.allPlaces.length,
  );
  await expect(page.getByText("Trip options", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show more destinations", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const schedule = page.getByRole("region", {
    name: "Whole-trip schedule",
    exact: true,
  });
  for (const day of originalDays)
    await expect(
      schedule.getByRole("heading", {
        name: dayLabel(day, f.trip.start_date),
        exact: true,
      }),
    ).toBeVisible();
  await expect(schedule).toContainText("Flexible time");
  await expect(schedule).toContainText("No stops planned for this day.");
  const notes = schedule.locator(".schedule-notes");
  await expect(notes.locator("p")).not.toBeVisible();
  await notes.locator("summary").click();
  await expect(notes).toContainText("Pack water");
  await shot(page, "schedule");
  expect(
    (await new AxeBuilder({ page }).include(".p2-trip-schedule").analyze())
      .violations,
  ).toEqual([]);
  await schedule
    .getByRole("button", {
      name: new RegExp(
        f.places[2].title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    })
    .click();
  await expect(page.locator(".p3-day-selected")).toContainText("Day 3");
  const stop = page.locator(".p2-stop");
  await stop.locator(".p3-stop-timing summary").click();
  const form = stop.locator(".p3-stop-timing form");
  await setVisitTime(form, "Start", "13:05");
  await setVisitTime(form, "End", "14:50");
  await form.getByRole("button", { name: "Save time", exact: true }).click();
  await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
  const deleteDay = page.getByRole("button", {
    name: `Delete ${dayLabel(originalDays[1], f.trip.start_date)}`,
    exact: true,
  });
  await page.locator(".planner-day-tab").nth(1).hover();
  await expect(deleteDay).toHaveCSS("opacity", "1");
  await deleteDay.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 stop");
  await expect(dialog).toContainText("Later days shift earlier");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".planner-day-tab")).toHaveCount(4);
  await page.mouse.move(0, 0);
  await deleteDay.focus();
  await expect(deleteDay).toHaveCSS("opacity", "1");
  await deleteDay.click();
  await shot(page, "delete-day");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".planner-day-tab")).toHaveCount(3);
  await expect(page.locator(".p3-day-selected")).toContainText("Day 2");
  await page.reload();
  await expect(page.locator(".planner-day-tab")).toHaveCount(3);
  await expect(page.locator(".p2-stop")).toContainText("1:05 PM");
  const saved: Trip = (
    await (
      await context.request.get(`${base}/api/v1/itineraries/${f.trip.id}/`)
    ).json()
  ).data;
  expect(saved.end_date).toBe("2027-01-01");
  expect(saved.itinerary_days.map((d) => d.id)).toEqual([
    originalDays[0].id,
    originalDays[2].id,
    originalDays[3].id,
  ]);
  expect(
    saved.items.find((i) => i.day_id === originalDays[2].id)?.start_time,
  ).toBe("13:05:00");
  expect(saved.items.some((i) => i.id === noted.id)).toBe(false);
  await page.getByRole("button", { name: "Edit trip", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete trip", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search destinations", exact: true })
    .fill(f.place.title);
  await expect(page.locator(".p2-search-results > li")).toHaveCount(1);
  await shot(page, "planner-search");
});

test("exploration uses reference controls, renders complete results and keeps cards aligned", async ({
  page,
  context,
}) => {
  test.setTimeout(100000);
  const f = await fixture(context);
  const category = f.place.category.split(" · ")[0];
  await page.goto(
    `/itineraries/explore/?trip=${f.trip.id}&day=${f.trip.itinerary_days[0].id}&category=${encodeURIComponent(category)}`,
  );
  const expected = f.allPlaces.filter((p) =>
    p.category.split(" · ").includes(category),
  );
  await expect(page.locator(".planner-destination-card")).toHaveCount(
    expected.length,
  );
  const toolbar = page.getByLabel("Destination filters", { exact: true });
  await expect(
    toolbar.getByRole("button", { name: "Motorcycle", exact: true }),
  ).toBeVisible();
  await expect(toolbar.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(toolbar.getByText("Assets", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show more destinations", exact: true }),
  ).toHaveCount(0);
  await toolbar
    .getByRole("button", { name: "Motorcycle", exact: true })
    .click();
  await expect(
    toolbar.getByRole("button", { name: "Motorcycle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await toolbar
    .getByRole("button", { name: "Reset destination filters", exact: true })
    .click();
  await expect(page.locator(".planner-destination-card")).toHaveCount(
    expected.length,
  );
  await toolbar
    .getByRole("button", { name: "Sort descending", exact: true })
    .click();
  await expect(
    toolbar.getByRole("button", { name: "Sort ascending", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    (await toolbar.locator(".planner-sort-direction svg").boundingBox())!.width,
  ).toBeGreaterThan(18);
  await toolbar
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("date");
  await expect(
    toolbar.getByRole("button", { name: "Sort ascending", exact: true }),
  ).toBeVisible();
  await toolbar
    .getByRole("button", { name: "Sort ascending", exact: true })
    .click();
  await expect(
    toolbar.getByRole("button", { name: "Sort descending", exact: true }),
  ).toBeVisible();
  const geometry = await page
    .locator(".planner-destination-card .upd-card__photo")
    .evaluateAll((nodes) =>
      nodes.slice(0, 3).map((n) => n.getBoundingClientRect().height),
    );
  expect(Math.max(...geometry) - Math.min(...geometry)).toBeLessThan(2);
  await shot(page, "exploration");
  if (page.viewportSize()!.width < 800) {
    await page.setViewportSize({ width: 320, height: 780 });
    await shot(page, "exploration-narrow");
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".planner-reference-toolbar")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("Explorer profile previews, direct checkout, compact hook and right-side menu", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await signIn(context, "explorer2@paradise.com");
  await page.goto("/account/");
  await expect(
    page.getByRole("heading", { name: "My Bucketlist", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My Portfolio", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".p3-profile-links")).toHaveCount(0);
  await expect(
    page
      .locator("#account-settings")
      .getByRole("link", { name: "Itinerary Planner" }),
  ).toHaveCount(0);
  if (page.viewportSize()!.width < 800) {
    await expect
      .poll(async () => {
        const membership = await page
          .locator(".p3-profile-sidebar")
          .boundingBox();
        const portfolio = await page
          .locator(".upd-profile__section")
          .filter({
            has: page.getByRole("heading", {
              name: "My Portfolio",
              exact: true,
            }),
          })
          .boundingBox();
        const settings = await page.locator("#account-settings").boundingBox();
        return Boolean(
          membership &&
          portfolio &&
          settings &&
          membership.y > portfolio.y &&
          settings.y > membership.y,
        );
      })
      .toBe(true);
  }
  await shot(page, "explorer-profile");
  await page.getByRole("link", { name: "View portfolio", exact: true }).click();
  await expect(page.locator(".member-lock--feature")).toContainText(
    "Portfolio",
  );
  await shot(page, "feature-hook");
  await expect(page.locator(".feature-hook > .member-lock__return")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  const upgrade = page.getByRole("link", {
    name: "Upgrade to Explorer+",
    exact: true,
  });
  await expect(upgrade).toHaveAttribute("href", /\/checkout\/\?return_to=/);
  await upgrade.click();
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(
    page.getByRole("heading", { name: "Go Explorer+", exact: true }),
  ).toBeVisible();
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toHaveClass(/p2-modal--right/);
    const box = await drawer.boundingBox();
    expect(box!.y).toBeLessThan(2);
    expect(box!.width).toBeLessThan(page.viewportSize()!.width);
    await expect
      .poll(async () => {
        const settled = await drawer.boundingBox();
        return Math.abs(
          settled!.x + settled!.width - page.viewportSize()!.width,
        );
      })
      .toBeLessThan(2);
    await shot(page, "right-menu");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  }
});

test("active Explorer+ membership shows status and category return opens the intended panel", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await signIn(context, "explorerplus2@paradise.com");
  await page.goto("/membership/");
  await expect(
    page.getByRole("heading", { name: "Your membership", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Get Explorer+", exact: true }),
  ).toHaveCount(0);
  await shot(page, "membership-status");
  await page.goto("/account/#account-settings");
  await page
    .locator("#account-settings")
    .getByText("Membership", { exact: true })
    .click();
  await page.getByRole("link", { name: "Renew", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Extend Explorer+", exact: true }),
  ).toBeVisible();
  await page.goto("/area/puerto-princesa/beaches/");
  await page
    .getByRole("link", { name: "All Puerto Princesa City categories" })
    .click();
  await expect(page).toHaveURL(/map_area=puerto-princesa/);
  await expect(page.locator("#map-overlay")).toHaveClass(/active/);
  await expect(page.locator("#overlay-area-name")).toHaveText(
    "Puerto Princesa City",
  );
  await shot(page, "category-return");
});
