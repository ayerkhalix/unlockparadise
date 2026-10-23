import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import type { Trip, TravelPlace } from "../src/lib/planning";

async function signIn(page: Page, email: string, path: string) {
  const origin = new URL(String(test.info().project.use.baseURL)).origin;
  if (
    ![
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://unlockparadise-staging.vercel.app",
    ].includes(origin)
  )
    throw new Error(
      "Demo credentials may only be used on the local preview or named staging site.",
    );
  const fixture = await readFile(
    "artifacts/deployment/demo-accounts.json",
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => null);
  test.skip(
    !fixture,
    "Local demo accounts are required for authenticated UI checks.",
  );
  const account = fixture.accounts.find(
    (a: { email: string }) => a.email === email,
  );
  await page.goto(`/login/?redirect_to=${encodeURIComponent(path)}`);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .locator('form[data-endpoint="/api/auth/login/"] button[type="submit"]')
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto(path);
}
async function capture(page: Page, label: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await mkdir("artifacts/polish", { recursive: true });
  await page.screenshot({
    path: `artifacts/polish/${label}-${test.info().project.name}.png`,
    fullPage: label !== "product-preview",
  });
}

test("merch uses cart wording and keeps failed cover photos usable", async ({
  page,
}) => {
  await page.goto("/merch/");
  const card = page.locator(".p2-product-card").first();
  await expect(
    card.getByRole("button", { name: /^Add to cart:/ }),
  ).toBeVisible();
  const src = await card.locator("img").first().getAttribute("src");
  await page.route(
    (url) => url.href.endsWith(src!),
    (route) => route.abort(),
  );
  await page.reload();
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".p2-photo-fallback")).toBeVisible();
  await capture(page, "merch");
  await page.goto("/merch/checkout/");
  await expect(
    page.getByText("Explorer+ membership is separate.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View membership plans" }),
  ).toBeVisible();
});

test("empty portfolio has its tabs and discovery action without unused filters", async ({
  page,
}) => {
  await signIn(page, "explorerplus2@paradise.com", "/portfolio/");
  await page.route("**/api/v1/portfolio/", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your portfolio is empty" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Your places" }),
  ).toBeVisible();
  await expect(page.locator(".p2-filters")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Discover Palawan" }),
  ).toBeVisible();
  await capture(page, "portfolio-empty");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("map failures keep area choices and provide an explicit retry", async ({
  page,
}) => {
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
  await page.goto("/");
  const map = page.locator(".p2-main-area-map");
  await map.scrollIntoViewIfNeeded();
  const retry = map.getByRole("button", { name: "Retry map", exact: true });
  await expect(retry).toBeVisible({ timeout: 30000 });
  await expect(map.getByRole("status")).toContainText(
    "Destination choices are still available",
  );
  expect(
    await map.getByRole("status").getByRole("link").count(),
  ).toBeGreaterThan(0);
  await retry.click();
  await expect(map).toHaveAttribute("data-map-attempt", "1");
  await expect(map.getByRole("status")).toContainText(
    /Loading satellite map|The map couldn’t load/,
  );
  await capture(page, "map-retry");
});

test("admin shows loading, retry and empty states separately and previews unsaved product edits", async ({
  page,
}) => {
  await signIn(page, "unlockadmin@paradise.com", "/admin/?section=merchandise");
  await expect(
    page
      .locator('.admin-table[aria-label="Merchandise catalog"] tbody tr')
      .first(),
  ).toBeVisible();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/admin/merchandise/**",
    async (route) => {
      await blocked;
      await route.fulfill({
        status: 503,
        json: { error: "Catalog temporarily unavailable." },
      });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const table = page.getByRole("region", {
    name: "Merchandise catalog",
    exact: true,
  });
  await expect(table).toHaveAttribute("aria-busy", "true");
  await expect(
    table.getByText("No matching products", { exact: false }),
  ).toHaveCount(0);
  await expect(table.getByRole("status")).toContainText(
    "Loading merchandise catalog",
  );
  await capture(page, "admin-loading");
  release();
  await expect(
    page.getByText("Catalog temporarily unavailable.", { exact: true }),
  ).toBeVisible();
  await expect(
    table.getByText("No matching products", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(table.locator("tbody tr").first()).toBeVisible();
  await page.route(
    "**/api/admin/merchandise/**",
    (route) => route.fulfill({ json: { data: [], count: 0 } }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(table).toHaveAttribute("aria-busy", "false");
  await expect(
    table.getByText(
      "No matching products. Add a product or clear the filters.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(table.locator("tbody tr").first()).toBeVisible();
  await table
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: /^Edit/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit product", exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "desktop-chrome") {
    await page
      .locator(".studio-sidebar")
      .getByRole("button", { name: "Switch to light theme", exact: true })
      .click();
  }
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Preview of unsaved client edits. <script> remains plain text.");
  await expect(page.getByLabel("Product readiness")).toContainText(
    "Description",
  );
  await page
    .getByRole("button", { name: "Preview product", exact: true })
    .click();
  const preview = page.getByRole("dialog", {
    name: "Product preview",
    exact: true,
  });
  await expect(
    preview
      .getByText("Preview of unsaved client edits.", { exact: false })
      .first(),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: /^Add to cart/ }),
  ).toHaveCount(0);
  await expect
    .poll(() => preview.evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    .toBe(true);
  await page.evaluate(async () => {
    await Promise.allSettled(
      document.getAnimations().map((animation) => animation.finished),
    );
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, "product-preview");
  await preview
    .getByRole("button", { name: "Close Product preview", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue(
    "Preview of unsaved client edits. <script> remains plain text.",
  );
});

test("planner warns about overlaps, prints all days and retains editable notes", async ({
  page,
  context,
  browserName,
  baseURL,
}) => {
  await signIn(page, "explorerplus2@paradise.com", "/itineraries/");
  const catalog = (
    await (await context.request.get("/api/v1/planning-places/")).json()
  ).data as TravelPlace[];
  const created = await context.request.post("/api/v1/itineraries/", {
    headers: { Origin: baseURL! },
    data: {
      title: "[TEST] Printable Palawan plan",
      notes: "Bring water.",
      start_date: "2026-11-01",
      end_date: "2026-11-02",
      day_count: 2,
    },
  });
  expect(created.ok()).toBe(true);
  let trip = (await created.json()).data as Trip;
  try {
    for (const [i, time] of [
      { start_time: "08:00", end_time: "12:00" },
      { start_time: "11:00", end_time: "13:00" },
      { start_time: null, end_time: null },
    ].entries()) {
      const added = await context.request.patch(
        `/api/v1/itineraries/${trip.id}/`,
        {
          headers: { Origin: baseURL! },
          data: {
            version: trip.version,
            action: "add",
            payload: {
              day_id: trip.itinerary_days[i === 2 ? 1 : 0].id,
              place_id: catalog[i].id,
              ...time,
            },
          },
        },
      );
      expect(added.ok()).toBe(true);
      trip = (await added.json()).data;
    }
    await page.goto(
      `/itineraries/?trip=${trip.id}&day=${trip.itinerary_days[0].id}`,
    );
    if (page.viewportSize()!.width <= 800) {
      const title = await page.locator(".p2-trip-header h1").boundingBox();
      expect(title!.width).toBeGreaterThan(250);
      expect(title!.height).toBeLessThan(110);
    }
    const timeline = page.getByRole("region", { name: "Daily timeline" });
    await expect(timeline).toContainText("Some visit times overlap");
    await expect(timeline.getByRole("button")).toHaveCount(2);
    await timeline.getByRole("button").first().click();
    await expect(page.locator(".p2-stop").first()).toBeFocused();
    const note = page
      .getByLabel("Notes for this stop", { exact: true })
      .first();
    await note.fill("Unsaved note");
    await page.evaluate(() => {
      (window as Window & { printed?: boolean }).printed = false;
      window.print = () => {
        (window as Window & { printed?: boolean }).printed = true;
      };
    });
    await page
      .getByRole("button", { name: "Print itinerary", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => (window as Window & { printed?: boolean }).printed,
      ),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Dismiss notification", exact: true })
      .click();
    await note.fill("");
    await page
      .getByRole("button", { name: "Print itinerary", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => (window as Window & { printed?: boolean }).printed,
      ),
    ).toBe(true);
    await capture(page, "planner-timeline");
    await page.emulateMedia({ media: "print" });
    const printable = page.getByRole("article", {
      name: "Printable itinerary",
      exact: true,
    });
    await expect(printable).toBeVisible();
    await expect(printable.locator("section")).toHaveCount(2);
    await expect(printable).toContainText(catalog[2].title);
    await expect(printable).toContainText("Overlapping time");
    await expect(page.locator(".app-theme")).toBeHidden();
    if (browserName === "chromium")
      await page.pdf({
        path: `artifacts/polish/itinerary-${test.info().project.name}.pdf`,
        format: "A4",
      });
    await page.emulateMedia({ media: "screen" });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    const latest = (
      await (
        await context.request.get(`/api/v1/itineraries/${trip.id}/`)
      ).json()
    ).data;
    await context.request.delete(`/api/v1/itineraries/${trip.id}/`, {
      headers: { Origin: baseURL! },
      data: { version: latest.version },
    });
  }
});
