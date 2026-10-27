import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { signIn } from "./helpers/demo-session";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import type { Trip, TravelPlace } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };
const recovery = new WeakMap<BrowserContext, () => Promise<void>>();
test.afterEach(async ({ context }) => {
  await recovery.get(context)?.();
  recovery.delete(context);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
});
async function shot(page: Page, name: string) {
  await mkdir("artifacts/planner-refinement", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  const modalOpen = (await page.locator("dialog:modal").count()) > 0;
  if (!modalOpen) {
    for (const dismiss of await page
      .getByRole("button", { name: "Dismiss notification", exact: true })
      .all())
      await dismiss.click({ timeout: 1000 }).catch(() => {});
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/planner-refinement/${name}-${page.viewportSize()!.width}.png`,
    fullPage: !modalOpen,
    animations: "disabled",
  });
}
async function fixture(context: BrowserContext) {
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        base + "/api/v1/planning-places/?search=Tagkawayan",
      )
    ).json()
  ).data[0];
  const title = `[TEST] Planner refinement ${randomUUID().slice(0, 8)}`;
  const made = await context.request.post(base + "/api/v1/itineraries/", {
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
  const places: TravelPlace[] = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?trip=${trip.id}`,
      )
    ).json()
  ).data.filter((place: TravelPlace) => !place.title.startsWith("[TEST]"));
  return {
    trip,
    places,
    title,
    async cleanup() {
      const latest: Trip = (
        await (
          await context.request.get(`${base}/api/v1/itineraries/${trip.id}/`)
        ).json()
      ).data;
      expect(latest.title).toBe(title);
      expect(
        (
          await context.request.delete(
            `${base}/api/v1/itineraries/${trip.id}/`,
            { headers, data: { version: latest.version } },
          )
        ).ok(),
      ).toBe(true);
    },
  };
}

test("planner views retain notes, show flexible schedule, and reorder into position time slots", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  const f = await fixture(context);
  let trip = f.trip;
  try {
    for (const [index, place] of f.places.slice(0, 3).entries()) {
      const response = await context.request.patch(
        `${base}/api/v1/itineraries/${trip.id}/`,
        {
          headers,
          data: {
            version: trip.version,
            action: "add",
            payload: {
              day_id: trip.itinerary_days[0].id,
              place_id: place.id,
              ...(index < 2
                ? {
                    start_time: index === 0 ? "08:00" : "13:00",
                    end_time: index === 0 ? "10:00" : "15:00",
                  }
                : {}),
            },
          },
        },
      );
      expect(response.ok()).toBe(true);
      trip = (await response.json()).data;
    }
    await page.goto(`/itineraries/?trip=${trip.id}`);
    const stops = page.locator(".p2-stop");
    await expect(stops).toHaveCount(3);
    await expect(stops.first().getByLabel("Notes for this stop")).toBeVisible();
    await stops.first().getByLabel("Notes for this stop").fill("Bring water.");
    await stops
      .first()
      .getByRole("button", { name: "Save note", exact: true })
      .click();
    await expect(page.locator(".p2-save-feedback")).toHaveText("Saved");
    await stops.first().locator(".p2-stop-actions > summary").click();
    await stops
      .first()
      .getByRole("button", { name: "Move down", exact: true })
      .click();
    await expect(stops.nth(1)).toContainText(f.places[0].title);
    await expect(
      stops.first().locator(".p3-stop-timing summary"),
    ).toContainText("8:00 AM");
    await expect(stops.nth(1).locator(".p3-stop-timing summary")).toContainText(
      "1:00 PM",
    );
    await expect(stops.nth(1).getByLabel("Notes for this stop")).toHaveValue(
      "Bring water.",
    );
    await shot(page, "itinerary-notes");
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    const schedule = page.getByRole("region", {
      name: "Whole-trip schedule",
      exact: true,
    });
    await expect(schedule).toBeVisible();
    await expect(schedule.locator("li")).toHaveCount(3);
    await expect(schedule).toContainText("Flexible time");
    await expect(
      page.getByRole("button", { name: "Schedule", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await shot(page, "schedule");
    await page.getByRole("button", { name: "My route", exact: true }).click();
    await expect(
      page.getByRole("complementary", { name: "Selected day map" }),
    ).toBeVisible();
    const finder = page.getByRole("region", { name: "Find destinations" });
    await expect(
      finder.getByRole("searchbox", {
        name: "Search destinations",
        exact: true,
      }),
    ).toBeVisible();
    expect((await finder.boundingBox())!.y).toBeGreaterThan(
      (await page.locator(".p2-plan-map").boundingBox())!.y,
    );
    await shot(page, "route-add-card");
    await expect(
      finder.getByLabel("Search destinations", { exact: true }),
    ).toBeVisible();
    await expect(finder.locator("[data-member-op]").first()).toBeVisible();
    await page.getByRole("button", { name: /^Day 2/ }).click();
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(schedule).toContainText("No stops planned for this day.");
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

test("explore has reference facets, Bucketlist and exact destination return", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  const f = await fixture(context);
  let newlySaved: string | null = null;
  try {
    const category = f.places[0].category.split(" · ")[0];
    await page.goto(
      `/itineraries/explore/?trip=${f.trip.id}&day=${f.trip.itinerary_days[0].id}&category=${encodeURIComponent(category)}&shown=48&sort=date`,
    );
    await expect(
      page.locator(".planner-destination-card").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "All destinations", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Travel time", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Car", exact: true }).click();
    await expect(page).toHaveURL(/access=Car/);
    await page
      .getByRole("button", { name: "Reset destination filters", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Sort by", exact: true })
      .selectOption("date");
    const card = page.locator(".planner-destination-card").first();
    const save = card.locator("[data-member-op]");
    await expect(save).toBeEnabled();
    if ((await save.getAttribute("data-member-op")) === "save") {
      newlySaved = await save.getAttribute("data-place-uuid");
      await save.click();
      await expect(save).toHaveAttribute("aria-pressed", "true");
    }
    await shot(page, "explore-filters-bucketlist");
    await card.scrollIntoViewIfNeeded();
    const source = page.url();
    await card.locator(".upd-card__title").click();
    await expect(page).toHaveURL(/\/place\/.*return_to=/);
    const clickedPosition = await page.evaluate(
      (url) =>
        JSON.parse(
          sessionStorage.getItem(
            `upd:browse-position:${new URL(url).pathname + new URL(url).search}`,
          ) || "null",
        ),
      source,
    );
    expect(clickedPosition).toBeTruthy();
    await page.getByRole("link", { name: "‹ Return", exact: true }).click();
    await expect(page).toHaveURL(source);
    await expect
      .poll(async () =>
        Math.abs(
          (await page
            .locator(".planner-destination-card a.upd-card__link")
            .first()
            .boundingBox())!.y - clickedPosition.top,
        ),
      )
      .toBeLessThan(14);
    await expect(
      page.getByRole("combobox", { name: "Sort by", exact: true }),
    ).toHaveValue("date");
    await expect(
      page.getByRole("link", { name: "My route", exact: true }),
    ).toHaveAttribute("href", /view=map/);
    expect(
      (await new AxeBuilder({ page }).include(".planner-browser").analyze())
        .violations,
    ).toEqual([]);
  } finally {
    if (newlySaved)
      expect(
        (
          await context.request.post(base + "/api/v1/bucketlist/", {
            headers,
            data: { place_id: newlySaved, op: "unsave" },
          })
        ).ok(),
      ).toBe(true);
    await f.cleanup();
  }
});

test("profile featured photo is visible, mobile rails swipe, menu leads with account identity", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  await signIn(context, "explorerplus2@paradise.com");
  const me = (await (await context.request.get(base + "/api/v1/me/")).json())
    .data;
  const before = (
    await (await context.request.get(base + "/api/v1/bucketlist/")).json()
  ).data;
  const catalog: TravelPlace[] = (
    await (await context.request.get(base + "/api/v1/planning-places/")).json()
  ).data;
  const added: string[] = [];
  const candidates = catalog
    .filter(
      (p) =>
        p.image &&
        !p.title.startsWith("[TEST]") &&
        !before.some(
          (row: { place_id: string; saved_at: string | null }) =>
            row.place_id === p.id && row.saved_at,
        ),
    )
    .slice(0, 2);
  let cleaned = false;
  let featureTouched = false;
  const cleanup = async () => {
    if (cleaned) return;
    const current = (
      await (
        await context.request.get(base + "/api/v1/me/", { timeout: 15000 })
      ).json()
    ).data;
    if (
      featureTouched &&
      (current.featured_place_id === candidates[0].id ||
        current.featured_place_id === null)
    )
      expect(
        (
          await context.request.patch(base + "/api/v1/me/", {
            headers,
            data: { featured_place_id: me.featured_place_id },
            timeout: 15000,
          })
        ).ok(),
      ).toBe(true);
    for (const id of added)
      expect(
        (
          await context.request.post(base + "/api/v1/bucketlist/", {
            headers,
            data: { place_id: id, op: "unsave" },
            timeout: 15000,
          })
        ).ok(),
      ).toBe(true);
    cleaned = true;
  };
  recovery.set(context, cleanup);
  try {
    for (const place of candidates) {
      expect(
        (
          await context.request.post(base + "/api/v1/bucketlist/", {
            headers,
            data: { place_id: place.id, op: "save" },
          })
        ).ok(),
      ).toBe(true);
      added.push(place.id);
    }
    featureTouched = true;
    expect(
      (
        await context.request.patch(base + "/api/v1/me/", {
          headers,
          data: { featured_place_id: null },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/account/");
    await expect(page.locator(".profile-featured-place")).toHaveCount(0);
    await expect(
      page.locator('[data-profile-feature][aria-pressed="true"]'),
    ).toHaveCount(0);
    const feature = page
      .locator(`[data-profile-feature="${candidates[0].id}"]`)
      .first();
    await feature.click();
    await expect(feature).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".profile-featured-place")).toContainText(
      candidates[0].title,
    );
    await expect
      .poll(() =>
        page
          .locator(".profile-featured-place img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    if (page.viewportSize()!.width < 680) {
      const rail = page.locator(".profile-swipe").first();
      // Selecting a star may scroll its card into view. Begin the swipe check
      // from the start, as a fresh visit to the account page would.
      await rail.evaluate((element) =>
        element.scrollTo({ left: 0, behavior: "instant" }),
      );
      expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
        true,
      );
      await page
        .getByRole("button", {
          name: "Next My Bucketlist destinations",
          exact: true,
        })
        .click();
      await expect
        .poll(() => rail.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(20);
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      const menu = page.getByRole("dialog", { name: /Explorer/ });
      await expect(page.locator(".mobile-menu-identity")).toBeVisible();
      await expect(
        menu.getByRole("link", { name: "My Bucketlist", exact: true }),
      ).toHaveCount(0);
      const links = await menu
        .locator(".p2-mobile-nav a,.p2-mobile-nav button")
        .allTextContents();
      expect(links.slice(-3).map((x) => x.trim())).toEqual([
        "Itinerary Planner",
        "My Portfolio",
        "Log out",
      ]);
      await shot(page, "mobile-account-menu");
      await page.keyboard.press("Escape");
    }
    await shot(page, "profile-featured-swipe");
    await page
      .getByRole("button", { name: "Remove featured place", exact: true })
      .click();
    await expect(page.locator(".profile-featured-place")).toHaveCount(0);
    await expect(feature).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(page.locator(".profile-featured-place")).toHaveCount(0);
    await page.goto("/membership/");
    await expect(page.getByRole("main")).not.toContainText(
      /save \d+%|Save up to|view your Explorer account/i,
    );
    await expect(
      page.getByRole("main").getByRole("link", { name: /^Itinerary Planner/ }),
    ).toHaveAttribute("href", "/itineraries/");
  } finally {
    if (test.info().status !== "timedOut") await cleanup();
  }
});

test("category back returns to the main map's correct area and regular cards return to their feed", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await signIn(context, "explorerplus2@paradise.com");
  await page.goto("/area/puerto-princesa/rivers/?sort=name");
  await expect(page.locator(".upd-grid")).toHaveAttribute(
    "data-upd-archive-ready",
    "true",
  );
  const card = page.locator(".upd-card__link").first();
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await card.locator(".upd-card__title").click();
  const clickedPosition = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem(
        "upd:browse-position:/area/puerto-princesa/rivers/?sort=name",
      ) || "null",
    ),
  );
  expect(clickedPosition).toBeTruthy();
  await page.getByRole("link", { name: "‹ Return", exact: true }).click();
  await expect(page).toHaveURL(/\/area\/puerto-princesa\/rivers\/\?sort=name/);

  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(".upd-card__link").first().boundingBox())!.y -
          clickedPosition.top,
      ),
    )
    .toBeLessThan(14);
  // Browser Back restores the same filtered feed, without requiring Return.
  await page
    .locator(".upd-card__link")
    .first()
    .locator(".upd-card__title")
    .click();
  await page.goBack();
  await expect(page.locator(".upd-grid")).toHaveAttribute(
    "data-upd-archive-ready",
    "true",
  );
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(".upd-card__link").first().boundingBox())!.y -
          clickedPosition.top,
      ),
    )
    .toBeLessThan(14);
  // Client navigation must initialize the next category's own filter controls.
  await page
    .locator('.area-navigation__categories a[href$="/beaches/"]')
    .click();
  await expect(page.locator(".upd-grid")).toHaveAttribute(
    "data-upd-archive-ready",
    "true",
  );
  await page.locator('select[data-ctl="sort"]').selectOption("date");
  await expect(page).toHaveURL(/sort=date/);
  await page.locator(".area-navigation__back").click();
  await expect(page).toHaveURL(/map_area=puerto-princesa/);
  await expect(page.locator(".map-overlay.active")).toBeVisible();
  await expect(page.locator("#overlay-area-name")).toHaveText(
    "Puerto Princesa City",
  );
  await shot(page, "back-to-categories");
  if (page.viewportSize()!.width < 680) {
    await page.goto("/area/puerto-princesa/coffee/");
    await page.locator(".area-navigation__back").click();
    await expect(page).toHaveURL(/map_page=1/);
    await expect(
      page
        .locator(".map-overlay.active")
        .getByRole("button", { name: "Coffee", exact: true }),
    ).toBeInViewport();
  }
});
