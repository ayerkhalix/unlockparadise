import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { signIn } from "./helpers/demo-session";
import type { ItineraryLibraryResult } from "../src/lib/itinerary-library";
import type { Trip, TravelPlace } from "../src/lib/planning";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
test.use({ actionTimeout: 20000, navigationTimeout: 30000 });
const headers = { Origin: base };
const cleanups = new WeakMap<BrowserContext, () => Promise<void>>();
test.afterEach(async ({ context }) => {
  await cleanups.get(context)?.();
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
});
async function screenshot(page: Page, name: string) {
  await mkdir("artifacts/itinerary-library", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/itinerary-library/${name}-${page.viewportSize()!.width}.png`,
    animations: "disabled",
  });
}
async function fixtures(context: BrowserContext) {
  await signIn(context, "explorerplus2@paradise.com");
  const prefix = `[TEST] Library ${randomUUID().slice(0, 8)}`;
  const saved = new Map<string, string>();
  cleanups.set(context, async () => {
    for (const [id, title] of saved) {
      const response = await context.request.get(
        `${base}/api/v1/itineraries/${id}/`,
        { maxRetries: 2 },
      );
      if (response.status() === 404) continue;
      expect(response.ok()).toBe(true);
      const trip: Trip = (await response.json()).data;
      expect(trip.title).toBe(title);
      expect(
        (
          await context.request.delete(`${base}/api/v1/itineraries/${id}/`, {
            headers,
            data: { version: trip.version },
          })
        ).ok(),
      ).toBe(true);
    }
  });
  const areas: { id: string; name: string }[] = (
    await (await context.request.get(`${base}/api/v1/areas/`)).json()
  ).data;
  const place: TravelPlace = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?search=Tagkawayan`,
      )
    ).json()
  ).data[0];
  const first = areas.find((a) => a.id === place.areaIds![0])!;
  const second = areas.find((a) => a.id !== first.id)!;
  const track = (trip: Trip) => {
    saved.set(trip.id, trip.title);
    return trip;
  };
  const create = async (
    name: string,
    area = first.id,
    start: string | null = null,
    end: string | null = null,
  ) => {
    const r = await context.request.post(`${base}/api/v1/itineraries/`, {
      headers,
      data: {
        title: `${prefix} ${name}`,
        notes: "Temporary owned library test",
        area_id: area,
        start_date: start,
        end_date: end,
        day_count: start ? 2 : 1,
      },
    });
    expect(r.ok()).toBe(true);
    return track((await r.json()).data);
  };
  return { prefix, areas, first, second, place, create, track };
}

test("library filters, covers, creation, guarded editor return and exploration preserve context", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const f = await fixtures(context);
  const alpha = await f.create(
    "Alpha coast",
    f.first.id,
    "2027-01-01",
    "2027-01-02",
  );
  let zulu = await f.create("Zulu weekend");
  await f.create("El Nido escape", f.second.id);
  const added = await context.request.patch(
    `${base}/api/v1/itineraries/${zulu.id}/`,
    {
      headers,
      data: {
        version: zulu.version,
        action: "add",
        payload: { day_id: zulu.itinerary_days[0].id, place_id: f.place.id },
      },
    },
  );
  expect(added.ok()).toBe(true);
  zulu = (await added.json()).data;
  await page.goto("/itineraries/");
  await expect(
    page.getByRole("heading", { name: "My itineraries", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Switch trip", exact: true }),
  ).toHaveCount(0);
  const search = page.getByRole("searchbox", {
    name: "Search itineraries",
    exact: true,
  });
  await search.fill(f.prefix);
  await expect(page.locator(".itinerary-library-card")).toHaveCount(3);
  await page.getByLabel("Area", { exact: true }).selectOption(f.first.id);
  await expect(page.locator(".itinerary-library-card")).toHaveCount(2);
  await page.getByLabel("Sort by", { exact: true }).selectOption("name");
  await expect(page.locator(".itinerary-library-card h2").first()).toHaveText(
    alpha.title,
  );
  const card = page.locator("a[data-itinerary-card]").filter({
    has: page.getByRole("heading", { name: zulu.title, exact: true }),
  });
  await expect(card).toContainText("1 destination");
  await expect(card.locator("img")).toBeVisible();
  await expect
    .poll(() =>
      card.locator("img").evaluate((img) => {
        const photo = img as HTMLImageElement;
        return photo.complete && photo.naturalWidth > 0;
      }),
    )
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).include(".itinerary-library").analyze())
      .violations,
  ).toEqual([]);
  await screenshot(page, "library");
  const library = new URL(page.url()).pathname + new URL(page.url()).search;
  await card.scrollIntoViewIfNeeded();
  await card.click({ position: { x: 40, y: 30 } });
  await expect(page).toHaveURL(new RegExp(`trip=${zulu.id}`));
  const savedTop = await page.evaluate(
    (url) =>
      JSON.parse(sessionStorage.getItem(`upd:browse-position:${url}`) || "null")
        ?.top,
    library,
  );
  expect(typeof savedTop).toBe("number");
  const note = page.getByRole("textbox", { name: /Notes for this stop/ });
  await note.fill("An unsaved library-return note");
  await expect(
    page.getByRole("button", { name: "Save note", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".p2-workspace-status")).toContainText("unsaved");
  await page.getByRole("link", { name: "My itineraries", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Discard unsaved");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(note).toHaveValue("An unsaved library-return note");
  await page.getByRole("link", { name: "My itineraries", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(page).toHaveURL(base + library);
  await expect(card).toBeVisible();
  await expect
    .poll(async () => Math.abs((await card.boundingBox())!.y - savedTop))
    .toBeLessThan(5);
  await card.click();
  await page
    .getByRole("button", { name: "Explore options", exact: true })
    .click();
  await expect(page).toHaveURL(/\/itineraries\/explore\//);
  expect(new URL(page.url()).searchParams.get("return_to")).toBe(library);
  await page.locator(".planner-browser-bar .p2-back").click();
  await page.getByRole("link", { name: "My itineraries", exact: true }).click();
  await expect(page).toHaveURL(base + library);
  await search.fill("No such library trip anywhere");
  await expect(
    page.getByRole("heading", { name: "No itineraries match your filters" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your first Palawan itinerary starts here",
    }),
  ).toHaveCount(0);
  await search.fill(f.prefix);
  await page.getByLabel("Area", { exact: true }).selectOption(f.second.id);
  await expect(page.locator(".itinerary-library-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Create itinerary", exact: true })
    .first()
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Trip area", { exact: true })).toHaveValue(
    f.second.id,
  );
  await modal
    .getByLabel("Trip name", { exact: true })
    .fill(`${f.prefix} New island plan`);
  const createdResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/itineraries/") &&
      r.request().method() === "POST",
  );
  await modal
    .getByRole("button", { name: "Create itinerary", exact: true })
    .click();
  const created = f.track((await (await createdResponse).json()).data);
  await expect(page).toHaveURL(new RegExp(`trip=${created.id}`));
  await expect(page.locator(".p2-trip-header h1")).toHaveText(created.title);
  await page.getByRole("link", { name: "My itineraries", exact: true }).click();
  await expect(page.locator(".itinerary-library-card")).toHaveCount(2);
});

test("library loading, empty states, retry, pagination and cancelled searches stay distinct", async ({
  page,
  context,
}) => {
  await signIn(context, "explorerplus2@paradise.com");
  let mode: "normal" | "fail" | "empty" = "normal";
  let releaseInitial!: () => void;
  const initial = new Promise<void>((resolve) => {
    releaseInitial = resolve;
  });
  let releaseSlow!: () => void;
  const slow = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  let slowStarted!: () => void;
  const slowReady = new Promise<void>((resolve) => {
    slowStarted = resolve;
  });
  const data = Array.from({ length: 13 }, (_, n) => ({
    id: randomUUID(),
    title: `Coastal plan ${n + 1}`,
    area_id: null,
    area: "Puerto North",
    start_date: null,
    end_date: null,
    day_count: 3,
    stop_count: n,
    image: null,
  }));
  let first = true;
  await page.route("**/api/v1/itineraries/library/**", async (route) => {
    if (first) {
      first = false;
      await initial;
    }
    const query = new URL(route.request().url()).searchParams;
    if (query.get("q") === "slow") {
      slowStarted();
      await slow;
    }
    if (mode === "fail")
      return route.fulfill({
        status: 503,
        json: { error: "Your saved plans could not be loaded. Try again." },
      });
    const count = mode === "empty" || query.get("q") === "none" ? 0 : 13;
    const pageNumber = Math.min(Number(query.get("page") || 1), 2);
    const result: ItineraryLibraryResult = {
      data: count
        ? data.slice((pageNumber - 1) * 12, pageNumber * 12).map((row) => ({
            ...row,
            title:
              query.get("q") === "new" ? "Latest search result" : row.title,
          }))
        : [],
      areas: [],
      count,
      total: mode === "empty" ? 0 : 13,
      page: pageNumber,
      pages: count ? 2 : 1,
      pageSize: 12,
    };
    await route.fulfill({ json: result }).catch(() => {});
  });
  await page.goto("/itineraries/");
  await expect(
    page.getByRole("status").filter({ hasText: "Loading your itineraries" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your first Palawan itinerary starts here"),
  ).toHaveCount(0);
  releaseInitial();
  await expect(page.locator(".itinerary-library-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".itinerary-library-card")).toHaveCount(1);
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  const search = page.getByRole("searchbox", {
    name: "Search itineraries",
    exact: true,
  });
  await search.fill("slow");
  await slowReady;
  await search.fill("new");
  await expect(page.locator(".itinerary-library-card h2").first()).toHaveText(
    "Latest search result",
  );
  releaseSlow();
  await expect(page.locator(".itinerary-library-card h2").first()).toHaveText(
    "Latest search result",
  );
  await search.fill("none");
  await expect(
    page.getByRole("heading", { name: "No itineraries match your filters" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear search itineraries", exact: true })
    .click();
  await expect(search).toBeFocused();
  await expect(page.locator(".itinerary-library-card")).toHaveCount(12);
  mode = "fail";
  await search.fill("retry");
  await expect(
    page.locator(".itinerary-library").getByRole("alert"),
  ).toContainText("saved plans could not be loaded");
  await expect(
    page.getByText("Your first Palawan itinerary starts here"),
  ).toHaveCount(0);
  await screenshot(page, "library-error");
  mode = "normal";
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".itinerary-library-card")).toHaveCount(12);
  mode = "empty";
  await search.fill("empty");
  await expect(
    page.getByRole("heading", {
      name: "Your first Palawan itinerary starts here",
    }),
  ).toBeVisible();
  await screenshot(page, "library-empty");
  expect(
    (await new AxeBuilder({ page }).include(".itinerary-library").analyze())
      .violations,
  ).toEqual([]);
  await page.evaluate(() =>
    history.pushState(null, "", "/itineraries/?create=1"),
  );
  await expect(
    page.getByRole("dialog", { name: "Create itinerary", exact: true }),
  ).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("create")).toBe(false);
});

test("real owner summaries paginate, clamp, sort and keep access boundaries", async ({
  context,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop-1440",
    "Run database pagination once; device behavior is covered separately.",
  );
  test.setTimeout(180000);
  const f = await fixtures(context);
  const trips: Trip[] = [];
  for (let n = 0; n < 13; n++)
    trips.push(await f.create(`${String(n).padStart(2, "0")} plan`));
  const get = async (extra = "") => {
    const response = await context.request.get(
      `${base}/api/v1/itineraries/library/?q=${encodeURIComponent(f.prefix)}${extra}`,
    );
    expect(response.ok()).toBe(true);
    return (await response.json()) as ItineraryLibraryResult;
  };
  const one = await get("&sort=name");
  const two = await get("&sort=name&page=2");
  expect(one.count).toBe(13);
  expect(one.data).toHaveLength(12);
  expect(two.data).toHaveLength(1);
  expect(new Set([...one.data, ...two.data].map((t) => t.id)).size).toBe(13);
  expect(one.data[0].title).toBe(trips[0].title);
  expect(
    one.data.every(
      (t) => t.day_count === 1 && t.stop_count === 0 && !("notes" in t),
    ),
  ).toBe(true);
  expect((await get("&page=999")).page).toBe(2);
  expect((await get(`&area=${f.second.id}`)).count).toBe(0);
  const outsider = await browser.newContext();
  try {
    expect(
      (
        await outsider.request.get(`${base}/api/v1/itineraries/library/`)
      ).status(),
    ).toBe(401);
    await signIn(outsider, "explorer2@paradise.com");
    expect(
      (
        await outsider.request.get(`${base}/api/v1/itineraries/library/`)
      ).status(),
    ).toBe(403);
    await outsider.clearCookies();
    await signIn(outsider, "explorerplus1@paradise.com");
    const foreign: ItineraryLibraryResult = await (
      await outsider.request.get(
        `${base}/api/v1/itineraries/library/?q=${encodeURIComponent(f.prefix)}`,
      )
    ).json();
    expect(foreign.data).toHaveLength(0);
  } finally {
    await outsider.close();
  }
});
