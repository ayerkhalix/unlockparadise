import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import type { Trip, TravelPlace } from "../src/lib/planning";
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
const base = "http://127.0.0.1:3000";

test.beforeAll(async ({ browser }) => {
  const fixture = JSON.parse(
    await readFile("artifacts/deployment/demo-accounts.json", "utf8"),
  );
  const account = fixture.accounts.find(
    (a: { email: string }) => a.email === "explorerplus2@paradise.com",
  );
  const cached = await readFile(
    "artifacts/planner-client-update/session.json",
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => undefined);
  const context = await browser.newContext({ storageState: cached });
  await context.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  const page = await context.newPage();
  await page.goto(base + "/itineraries/");
  if (new URL(page.url()).pathname === "/login/") {
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page
      .locator('form[data-endpoint="/api/auth/login/"] button[type=submit]')
      .click();
  }
  await page.waitForURL((u) => u.pathname === "/itineraries/");
  cookies = await context.cookies();
  await mkdir("artifacts/planner-client-update", { recursive: true });
  await writeFile(
    "artifacts/planner-client-update/session.json",
    JSON.stringify(await context.storageState()),
  );
  await context.close();
});
test.beforeEach(async ({ context, page }) => {
  await context.addCookies(cookies);
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
});
async function seed(context: BrowserContext) {
  const catalog = (
    await (await context.request.get(base + "/api/v1/planning-places/")).json()
  ).data as TravelPlace[];
  const preferred = ["tagkawayan", "secret river", "vietville"];
  const candidates = catalog.filter(
    (p) => p.image && !/^\[test\]/i.test(p.title),
  );
  const places = [...candidates]
    .sort((a, b) => {
      const rank = (p: TravelPlace) =>
        preferred.findIndex((title) => p.title.toLowerCase().includes(title));
      return (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b));
    })
    .slice(0, 3);
  expect(places).toHaveLength(3);
  const made = await context.request.post(base + "/api/v1/itineraries/", {
    headers: { Origin: base },
    data: {
      title: "[TEST] Client planner layout",
      notes: "Keep an offline copy.",
      start_date: "2026-11-01",
      end_date: "2026-11-02",
      day_count: 2,
    },
  });
  expect(made.ok()).toBe(true);
  let trip = (await made.json()).data as Trip;
  for (const [i, place] of places.entries()) {
    const saved = await context.request.patch(
      `${base}/api/v1/itineraries/${trip.id}/`,
      {
        headers: { Origin: base },
        data: {
          version: trip.version,
          action: "add",
          payload: {
            day_id: trip.itinerary_days[0].id,
            place_id: place.id,
            start_time: `${String(8 + i * 2).padStart(2, "0")}:00`,
            end_time: `${String(9 + i * 2).padStart(2, "0")}:00`,
          },
        },
      },
    );
    expect(saved.ok()).toBe(true);
    trip = (await saved.json()).data;
  }
  return { trip, places };
}
async function cleanup(context: BrowserContext, trip: Trip) {
  test.setTimeout(test.info().timeout + 20000);
  const result = await context.request.get(
    `${base}/api/v1/itineraries/${trip.id}/`,
  );
  if (!result.ok()) return;
  const current = (await result.json()).data;
  expect(current.title).toBe("[TEST] Client planner layout");
  expect(
    (
      await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
        headers: { Origin: base },
        data: { version: current.version },
      })
    ).ok(),
  ).toBe(true);
}
async function capture(page: Page, name: string) {
  for (const img of await page.locator(".p2-stop-heading img:visible").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete))
      .toBe(true);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/planner-client-update/${name}-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
async function dragFirstToSecond(page: Page, context: BrowserContext) {
  const stops = page.locator(".p2-stop");
  await stops.last().scrollIntoViewIfNeeded();
  const handle = await stops
    .first()
    .locator(".p2-stop-actions > summary")
    .boundingBox();
  const target = await stops.nth(1).boundingBox();
  expect(handle!.y).toBeGreaterThan(0);
  const x = handle!.x + handle!.width / 2,
    y = handle!.y + handle!.height / 2;
  const tx = target!.x + target!.width / 2,
    ty = target!.y + target!.height / 2;
  if (test.info().project.name.includes("mobile")) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await expect(stops.first()).toHaveAttribute("data-dragging", "true");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: tx, y: ty }],
    });
    await expect(stops.nth(1)).toHaveAttribute("data-drop-target", "true");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(stops.first()).toHaveAttribute("data-dragging", "true");
    await page.mouse.move(tx, ty, { steps: 10 });
    await expect(stops.nth(1)).toHaveAttribute("data-drop-target", "true");
    await page.mouse.up();
  }
}

test("client layout keeps stop options, notes, exports and maps functional", async ({
  page,
  context,
}) => {
  test.setTimeout(100000);
  const { trip, places } = await seed(context);
  try {
    await page.goto(`/itineraries/?trip=${trip.id}`);
    const views = page.getByRole("group", { name: "Planner view" });
    await expect(
      views.getByRole("button", { name: "Itinerary", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const stops = page.locator(".p2-stop");
    await expect(stops).toHaveCount(3);
    await expect(stops.first().getByLabel("Notes for this stop")).toBeVisible();
    await expect(
      stops.first().getByRole("button", { name: "Move down", exact: true }),
    ).toBeHidden();
    await expect(page.locator("#planner-destination-search")).toBeHidden();
    await capture(page, "plan");
    expect(
      (await new AxeBuilder({ page }).include(".p2-workspace").analyze())
        .violations,
    ).toEqual([]);
    const firstOptions = stops.first().locator(".p2-stop-actions > summary");
    await firstOptions.focus();
    await page.keyboard.press("Enter");
    await expect(
      stops.first().getByRole("button", { name: "Move up", exact: true }),
    ).toBeDisabled();
    await capture(page, "options");
    await stops
      .first()
      .getByRole("button", { name: "Move down", exact: true })
      .click();
    await expect(stops.first()).toContainText(places[1].title);
    await expect(stops.first().locator(".p2-stop-actions")).not.toHaveAttribute(
      "open",
      "",
    );
    const notes = stops.first().getByLabel("Notes for this stop");
    await notes.fill("Bring water and a camera.");
    await stops
      .first()
      .getByRole("button", { name: "Save note", exact: true })
      .click();
    await expect(
      stops.first().getByRole("button", { name: "Save note", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".p2-fieldset:has(.p2-stops)")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await stops.first().locator(".p2-stop-actions > summary").click();
    await page.keyboard.press("Escape");
    await expect(
      stops.first().locator(".p2-stop-actions > summary"),
    ).toBeFocused();
    await stops.first().locator(".p2-stop-actions > summary").click();
    await stops
      .first()
      .getByLabel(/Move to another day/)
      .selectOption(trip.itinerary_days[1].id);
    await expect(stops).toHaveCount(2);
    await dragFirstToSecond(page, context);
    await expect(stops.first()).toContainText(places[2].title);
    await expect(page.locator('[data-dragging="true"]')).toHaveCount(0);
    await page.reload();
    await expect(stops.first()).toContainText(places[2].title);
    const days = page.getByRole("navigation", { name: "Itinerary days" });
    await days.getByRole("button", { name: /^Day 2/ }).click();
    await expect(stops.first().getByLabel("Notes for this stop")).toHaveValue(
      "Bring water and a camera.",
    );
    await stops
      .first()
      .getByLabel("Notes for this stop")
      .fill("Unsaved reminder");
    await days.getByRole("button", { name: /^Day 1/ }).click();
    await page
      .getByRole("dialog", { name: "Confirm action", exact: true })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(stops.first().getByLabel("Notes for this stop")).toHaveValue(
      "Unsaved reminder",
    );
    await stops
      .first()
      .getByLabel("Notes for this stop")
      .fill("Bring water and a camera.");
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download trip", exact: true })
      .click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toMatch(/\.html$/);
    const path = await file.path();
    const html = await readFile(path!, "utf8");
    expect(html).toContain("Bring water and a camera.");
    for (const place of places)
      expect(html).toContain(place.title.replaceAll("&", "&amp;"));
    await views.getByRole("button", { name: "My route", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My route", exact: true }),
    ).toBeVisible();
    await expect(
      views.getByRole("button", { name: "My route", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await capture(page, "route");
    await views.getByRole("button", { name: "Itinerary", exact: true }).click();
    const finder = page.locator("#find-destinations");
    await finder
      .getByRole("button", { name: "Search destination", exact: true })
      .click();
    await expect(finder.getByRole("searchbox")).toBeFocused();
    await expect(
      finder.locator("button[data-place-choice]").first(),
    ).toBeVisible();
    await finder
      .getByRole("button", { name: "Explore options", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Explore options", exact: true }),
    ).toBeVisible();
  } finally {
    await cleanup(context, trip);
  }
});

test("failed and canceled reorders preserve the saved plan", async ({
  page,
  context,
}) => {
  const { trip, places } = await seed(context);
  try {
    await page.goto(`/itineraries/?trip=${trip.id}`);
    const stops = page.locator(".p2-stop");
    await expect(stops).toHaveCount(3);
    await page.route(`**/api/v1/itineraries/${trip.id}/`, async (route) => {
      if (route.request().method() === "PATCH")
        return route.fulfill({
          status: 409,
          json: { error: "Plan changed. Reload before trying again." },
        });
      await route.continue();
    });
    await stops.first().locator(".p2-stop-actions > summary").click();
    await stops
      .first()
      .getByRole("button", { name: "Move down", exact: true })
      .click();
    await expect(page.locator(".p2-error[role=alert]")).toContainText(
      "Plan changed",
    );
    await expect(stops.first()).toContainText(places[0].title);
    await expect(
      stops.first().getByRole("button", { name: "Move down", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");
    const handle = stops.first().locator(".p2-stop-actions > summary");
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    await page.mouse.move(box!.x + 20, box!.y + 20);
    await page.mouse.down();
    await expect(stops.first()).toHaveAttribute("data-dragging", "true");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator('[data-dragging="true"]')).toHaveCount(0);
    await expect(stops.first()).toContainText(places[0].title);
    await capture(page, "recovery");
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await cleanup(context, trip);
  }
});
