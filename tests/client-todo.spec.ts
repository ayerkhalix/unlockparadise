import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { readFile, mkdir } from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { AxeBuilder } from "@axe-core/playwright";
import type { Trip } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const origin = { Origin: base };
const cached = new Map<
  string,
  Awaited<ReturnType<BrowserContext["cookies"]>>
>();
async function signIn(context: BrowserContext, email: string) {
  if (!cached.has(email)) {
    const env = parseEnv(await readFile(".env.local", "utf8"));
    const fixture = JSON.parse(
      await readFile("artifacts/deployment/demo-accounts.json", "utf8"),
    );
    const account = fixture.accounts.find(
      (a: { email: string }) => a.email === email,
    );
    const jar = new Map<string, string>();
    const db = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (values) =>
            values.forEach((item) => jar.set(item.name, item.value)),
        },
      },
    );
    const result = await db.auth.signInWithPassword({
      email,
      password: account.password,
    });
    if (result.error) throw Error("Demo sign-in unavailable");
    cached.set(
      email,
      [...jar].map(([name, value]) => ({
        name,
        value,
        domain: new URL(base).hostname,
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      })),
    );
  }
  await context.addCookies(cached.get(email)!);
}
test.beforeEach(async ({ page }, info) => {
  await page.route("https://api.mapbox.com/**", (route) => route.abort());
  if (!info.title.startsWith("compact cookie"))
    await page.addInitScript(() =>
      localStorage.setItem("upd-analytics-consent", "off"),
    );
});
async function shot(page: Page, name: string) {
  await mkdir("artifacts/client-todo", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  for (const image of await page.locator("img:visible").all()) {
    await image.scrollIntoViewIfNeeded().catch(() => {});
    await image
      .evaluate(
        (img: HTMLImageElement) =>
          img.complete ||
          new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000);
          }),
      )
      .catch(() => {});
  }
  for (const dismiss of await page
    .getByRole("button", { name: "Dismiss notification", exact: true })
    .all())
    await dismiss.click().catch(() => {});
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/client-todo/${name}-${page.viewportSize()!.width}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
test("guest previews, distinct gates and navigation preserve the membership boundary", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator(".upd-hero-cats")).toHaveCount(0);
  await expect(page.locator(".destination-invitation")).toBeVisible();
  const result = await request.get(base + "/api/v1/places/?limit=100");
  expect(result.ok()).toBe(true);
  const places = (await result.json()).data;
  const hidden = places.find(
    (p: { vip_content: boolean; preview_id?: string }) =>
      p.vip_content && p.preview_id,
  );
  expect(hidden).toBeTruthy();
  expect(hidden.title).toBe("Explorer+ destination");
  expect(hidden.slug).toBe(hidden.id);
  expect(hidden.place_media).toEqual([]);
  const preview = await request.get(base + `/api/previews/${hidden.id}/`);
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toBe("image/webp");
  expect(preview.headers().location).toBeUndefined();
  const featured = await request.get(base + "/api/v1/places/?featured=1");
  expect(featured.ok()).toBe(true);
  await shot(page, "home");
  await page.locator("#palawan-map").scrollIntoViewIfNeeded();
  const zoomOut = page.locator(".p2-main-area-map .mapboxgl-ctrl-zoom-out");
  await expect(zoomOut).toBeVisible();
  const zoomBox = (await zoomOut.boundingBox())!;
  const dockBox = (await page.locator(".p2-floating").boundingBox())!;
  expect(zoomBox.y + zoomBox.height + 12).toBeLessThanOrEqual(dockBox.y);
  await page.goto(`/place/${hidden.id}/`);
  await expect(
    page.getByRole("heading", { name: "Explorer+ destination", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".member-lock")).toContainText(
    "explore this destination",
  );
  await expect(
    page.getByRole("link", { name: "Upgrade to Explorer+", exact: true }),
  ).toHaveAttribute("href", /^\/membership\/\?return_to=/);
  await shot(page, "destination-gate");
  await page.goto("/itineraries/");
  await expect(
    page.getByRole("heading", { name: "Itinerary Planner", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".member-lock")).toContainText(
    "access this feature",
  );
  expect(new URL(page.url()).pathname).toBe("/itineraries/");
  await page.goto("/bucketlist/");
  await expect(page.locator(".member-lock")).toBeVisible();
  await shot(page, "feature-gate");
  expect((await request.get(base + "/api/v1/planning-places/")).status()).toBe(
    401,
  );
  expect((await request.get(base + "/api/admin/places/")).status()).toBe(401);
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Explore Unlock Paradise" });
    await expect(
      menu.getByRole("link", { name: "Register free", exact: true }),
    ).toBeVisible();
    await expect(menu.locator(".p2-account")).toHaveCount(0);
    expect((await menu.boundingBox())!.x).toBeLessThan(2);
    await shot(page, "mobile-menu");
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  }
});

test("compact cookie choices preserve consent and keyboard behavior", async ({
  page,
}) => {
  await page.goto("/join/");
  const dialog = page.getByRole("dialog", { name: "Cookies & privacy" });
  await expect(
    dialog.getByRole("button", { name: "No thanks", exact: true }),
  ).toBeVisible();
  const size = await dialog.boundingBox();
  expect(size!.height).toBeLessThan(650);
  await shot(page, "cookies");
  await dialog.getByRole("button", { name: "Manage preferences", exact: true }).click();
  await expect(dialog).toContainText("Optional cookies");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "No thanks", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Privacy preferences", exact: true })).toHaveCount(0);
  await expect(page.locator(".p2-privacy-preferences")).toHaveCount(0);
});

test("Explorer card actions show the upgrade hook without granting access", async ({
  page,
  context,
}) => {
  await signIn(context, "explorer2@paradise.com");
  const result = await context.request.get(base + "/api/v1/places/?limit=100");
  const place = (await result.json()).data.find(
    (p: { place_areas: { areas: { slug: string } }[] }) => p.place_areas.length,
  );
  expect(place).toBeTruthy();
  await page.goto(`/area/${place.place_areas[0].areas.slug}/`);
  const card = page.locator(".upd-card").first();
  await expect(
    card.getByRole("link", { name: "Add to Bucketlist", exact: true }),
  ).toBeVisible();
  await card
    .getByRole("link", { name: "Add to Bucketlist", exact: true })
    .click();
  await expect(page.locator(".member-lock")).toContainText("Bucketlist");
  expect(new URL(page.url()).pathname).toBe("/explorer-plus/");
  expect(
    (await context.request.get(base + "/api/v1/planning-places/")).status(),
  ).toBe(403);
  await shot(page, "explorer-hook");
});

test("profile edits are compact, persist, recover from failure and protect drafts", async ({
  page,
  context,
}) => {
  await signIn(context, "explorerplus2@paradise.com");
  await page.goto("/account/");
  await expect(
    page.getByRole("button", { name: "Edit profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit Travel Preferences", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change profile photo", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".upd-stats li")).toHaveCount(2);
  await expect(page.locator(".upd-stats")).not.toContainText("Areas explored");
  await shot(page, "profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit profile",
    exact: true,
  });
  await expect(
    editor.getByRole("button", { name: "Remove photo", exact: true }),
  ).toHaveCount(0);
  const field = editor.getByLabel("Name", { exact: true });
  const original = await field.inputValue();
  await field.fill("Synthetic unsaved profile");
  let releaseSave!: () => void;
  const pendingSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/api/v1/me/", async (route) => {
    await pendingSave;
    await route.fulfill({
      status: 503,
      json: { error: "Synthetic save failure" },
    });
  });
  await editor.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Upload photo", exact: true }),
  ).toBeDisabled();
  await expect(
    editor.getByRole("button", { name: "Save preferences", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("button", { name: "Close Edit profile", exact: true })
    .click();
  await expect(editor).toBeVisible();
  releaseSave();
  await expect(editor.getByRole("alert")).toContainText(
    "Synthetic save failure",
  );
  await expect(field).toHaveValue("Synthetic unsaved profile");
  await page.unroute("**/api/v1/me/");
  await field.fill(original);
  await expect(
    editor.getByRole("button", { name: "Save name", exact: true }),
  ).toBeDisabled();
  const pace = editor.getByRole("combobox", {
    name: "Travel pace",
    exact: true,
  });
  const savedPace = await pace.inputValue();
  await pace.selectOption(savedPace === "slow" ? "balanced" : "slow");
  await page.route("**/api/v1/traveler/", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 409,
          json: { error: "Synthetic version conflict" },
        })
      : route.continue(),
  );
  await editor
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText(
    "Synthetic version conflict",
  );
  await editor
    .getByRole("button", { name: "Reload saved preferences", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Confirm action", exact: true })
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(pace).toHaveValue(savedPace);
  await expect(editor.getByRole("alert")).toHaveCount(0);
  await page.unroute("**/api/v1/traveler/");
  await shot(page, "profile-editor");
  await editor
    .getByRole("button", { name: "Close Edit profile", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("planner browsing keeps the selected day, saved times, route and branded exports", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await signIn(context, "explorerplus2@paradise.com");
  const places = (
    await (
      await context.request.get(
        base + "/api/v1/planning-places/?search=Tagkawayan",
      )
    ).json()
  ).data;
  const areaId = places[0].areaIds[0];
  const made = await context.request.post(base + "/api/v1/itineraries/", {
    headers: origin,
    data: {
      title: "[TEST] Client todo itinerary",
      area_id: areaId,
      notes: "Synthetic release check",
      start_date: "2026-11-03",
      end_date: "2026-11-04",
      day_count: 2,
    },
  });
  expect(made.ok()).toBe(true);
  let trip = (await made.json()).data as Trip;
  try {
    const day = trip.itinerary_days[1];
    let allowHydration!: () => void;
    const hydration = new Promise<void>((resolve) => {
      allowHydration = resolve;
    });
    const scripts = /\/_next\/static\/.*\.js(?:\?|$)/;
    await page.route(scripts, async (route) => {
      await hydration;
      await route.continue();
    });
    await page.goto(`/itineraries/?trip=${trip.id}&day=${day.id}`, {
      waitUntil: "commit",
    });
    const exportButton = page.getByRole("button", {
      name: "Download trip",
      exact: true,
    });
    await expect(exportButton).toBeDisabled();
    allowHydration();
    await page.unroute(scripts);
    await expect(exportButton).toBeEnabled();
    await page
      .getByRole("button", { name: "Explore destinations", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname === "/itineraries/explore/");
    await expect(
      page.getByRole("link", { name: "View final itinerary", exact: true }),
    ).toHaveAttribute("href", new RegExp(day.id));
    await expect(
      page.locator(".planner-destination-card").first(),
    ).toBeVisible();
    await expect(page.locator(".p2-floating")).toHaveCount(0);
    const scoped = await context.request.get(
      `${base}/api/v1/planning-places/?trip=${trip.id}&area=el-nido`,
    );
    const areaPlaces = (await scoped.json()).data;
    expect(areaPlaces.length).toBeGreaterThan(0);
    expect(
      areaPlaces.every((p: { areaIds: string[] }) =>
        p.areaIds.includes(areaId),
      ),
    ).toBe(true);
    const dayChoice = page.getByRole("combobox", {
      name: "Itinerary day",
      exact: true,
    });
    await expect(dayChoice).toHaveValue(day.id);
    await dayChoice.selectOption(trip.itinerary_days[0].id);
    await expect(
      page.getByRole("link", { name: "View final itinerary", exact: true }),
    ).toHaveAttribute("href", new RegExp(trip.itinerary_days[0].id));
    const category = page.locator(".planner-category-tabs button").nth(1);
    await category.hover();
    const contrast = await category.evaluate((el) => ({
      text: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    }));
    expect(contrast.text).not.toBe(contrast.background);
    await page
      .getByLabel("Search destinations", { exact: true })
      .fill("Tagkawayan");
    await expect(
      page.locator(".planner-destination-card").first(),
    ).toContainText("Tagkawayan");
    await page
      .locator(".planner-destination-card")
      .first()
      .getByRole("button", { name: "Add to itinerary", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal
      .getByRole("combobox", { name: "Add to day", exact: true })
      .selectOption(day.id);
    await modal.locator('input[type="time"]').nth(0).fill("08:00");
    await modal.locator('input[type="time"]').nth(1).fill("10:00");
    await modal
      .getByRole("button", { name: "Add destination", exact: true })
      .click();
    await expect(modal).not.toBeVisible();
    await expect(
      page
        .getByRole("button", { name: "Added to itinerary", exact: true })
        .first(),
    ).toBeDisabled();
    await shot(page, "planner-browser");
    await page.reload();
    await expect(
      page.getByLabel("Search destinations", { exact: true }),
    ).toHaveValue("Tagkawayan");
    await expect(
      page
        .getByRole("button", { name: "Added to itinerary", exact: true })
        .first(),
    ).toBeDisabled();
    await page
      .getByRole("link", { name: "View final itinerary", exact: true })
      .click();
    await expect(page.locator(".p2-stop")).toHaveCount(1);
    await expect(page.locator(".p2-stop")).toContainText("8:00 AM");
    expect(
      await page.evaluate(
        () =>
          !!(
            document
              .querySelector(".p2-stop")!
              .compareDocumentPosition(
                document.querySelector(".p2-day-schedule")!,
              ) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    ).toBe(true);
    await expect(page.locator(".p2-place-search select")).toHaveCount(0);
    const download = page.waitForEvent("download", { timeout: 20000 });
    await page
      .getByRole("button", { name: "Download trip", exact: true })
      .click();
    const artifact = await download;
    const html = await readFile((await artifact.path())!, "utf8");
    await artifact.saveAs(
      `artifacts/client-todo/itinerary-${page.viewportSize()!.width}.html`,
    );
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("Unlock Paradise");
    expect(html).toContain("8:00 AM");
    await page.pdf({
      path: `artifacts/client-todo/browser-print-${page.viewportSize()!.width}.pdf`,
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });
    await page.getByRole("button", { name: "My route", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My route", exact: true }),
    ).toBeVisible();
    const retry = page.getByRole("button", { name: "Retry map", exact: true });
    await expect(
      page.getByRole("link", { name: "Open main map", exact: true }),
    ).toHaveCount(0);
    await expect(retry).toBeVisible();
    const feedbackBox = (await page
      .locator(".p2-planning-map .p2-map-feedback")
      .boundingBox())!;
    const browserBox = (await page
      .locator(".p2-planning-map .p2-map-browser")
      .boundingBox())!;
    expect(browserBox.y).toBeGreaterThanOrEqual(
      feedbackBox.y + feedbackBox.height + 6,
    );
    await retry.scrollIntoViewIfNeeded();
    expect(
      await retry.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return hit === button || button.contains(hit);
      }),
    ).toBe(true);
    await shot(page, "planner-route");
    await page
      .getByRole("button", { name: "Final itinerary", exact: true })
      .click();
    await shot(page, "planner-plan");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    test.setTimeout(test.info().timeout + 30000);
    const latest = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
      { timeout: 20000 },
    );
    if (latest.ok()) {
      trip = (await latest.json()).data;
      expect(trip.title).toBe("[TEST] Client todo itinerary");
      expect(
        (
          await context.request.delete(
            `${base}/api/v1/itineraries/${trip.id}/`,
            { headers: origin, data: { version: trip.version } },
          )
        ).ok(),
      ).toBe(true);
    }
  }
});

test("admin library, visual writing and structured journey save without HTML", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await signIn(context, "unlockadmin@paradise.com");
  await page.goto("/admin/");
  await expect(
    page.getByRole("heading", { name: "The Merchandise library", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".studio-merch-preview .studio-specimen").first(),
  ).toBeVisible();
  await expect(
    page.locator(".studio-topbar .studio-theme-toggle"),
  ).toBeVisible();
  const products = (
    await (
      await context.request.get(
        base + "/api/admin/merchandise/?status=publish&offset=0",
      )
    ).json()
  ).data;
  expect(products[0].merch_collections.name).toBeTruthy();
  await expect(
    page.locator(".studio-merch-preview .studio-specimen-meta").first(),
  ).toHaveText(products[0].merch_collections.name);
  await shot(page, "admin");
  const suffix = randomUUID().slice(0, 8),
    title = `[TEST] Visual journey ${suffix}`,
    slug = `test-visual-journey-${suffix}`;
  let placeId: string | undefined;
  try {
    await page
      .getByRole("button", { name: "Add Place", exact: true })
      .first()
      .click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.locator('input[name="slug"]').fill(slug);
    const visual = page.getByRole("textbox", {
      name: "Description",
      exact: true,
    });
    await visual.fill("A synthetic description for the client review.");
    await visual.press("Control+a");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await expect(
      page.locator('input[type="hidden"][name="description"]'),
    ).toHaveValue(/<(b|strong)>/);
    await page
      .locator("summary")
      .filter({ hasText: "Getting there: road and boat" })
      .click();
    await page
      .getByLabel("Starting point", { exact: true })
      .fill("Synthetic city terminal");
    await page
      .getByLabel("Verified boat access required", { exact: true })
      .check();
    await page
      .getByLabel("Departure port or access point", { exact: true })
      .fill("Synthetic departure dock");
    await shot(page, "admin-editor");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Add Place", exact: true }),
    ).not.toBeVisible();
    const rows = await (
      await context.request.get(
        base + `/api/admin/places/?search=${encodeURIComponent(title)}`,
      )
    ).json();
    placeId = rows.data.find((row: { slug: string }) => row.slug === slug)?.id;
    expect(placeId).toBeTruthy();
    const saved = (
      await (
        await context.request.get(base + `/api/admin/places/${placeId}/`)
      ).json()
    ).data[0];
    expect(saved.place_details.description).toContain("synthetic description");
    expect(saved.place_details.journey_start).toBe("Synthetic city terminal");
    expect(saved.place_details.departure_port).toBe("Synthetic departure dock");
    const body = {
      title,
      slug,
      status: "archived",
      vip_content: false,
      premium_content: false,
      listing_types: ["destination"],
      travel_minutes: null,
      accessibility: [],
      assets: [],
      featured: false,
      feature_order: 0,
      description: saved.place_details.description,
      content: "",
      excerpt: "",
      latitude: null,
      longitude: null,
      weekday_crowd: "",
      weekend_crowd: "",
      area_ids: [],
      category_ids: [],
      gallery: [],
      cover_id: null,
      expected_updated_at: saved.updated_at,
    };
    expect(
      (
        await context.request.patch(base + `/api/admin/places/${placeId}/`, {
          headers: origin,
          data: body,
        })
      ).ok(),
    ).toBe(true);
  } finally {
    if (placeId)
      expect(
        (
          await context.request.delete(base + `/api/admin/places/${placeId}/`, {
            headers: origin,
            data: { confirm_slug: slug },
          })
        ).ok(),
      ).toBe(true);
  }
});

test("release edge: Back restores browsing context and preview denial stays private", async ({
  page,
  request,
}) => {
  const rows = (
    await (await request.get(base + "/api/v1/places/?limit=100")).json()
  ).data;
  const hidden = rows.find(
    (p: { vip_content: boolean; preview_id?: string }) =>
      p.vip_content && p.preview_id,
  );
  const area = rows.find(
    (p: { place_areas: { areas: { slug: string } }[] }) => p.place_areas.length,
  ).place_areas[0].areas.slug;
  const previous = `/area/${area}/?q=beach`;
  await page.goto(previous);
  await page.waitForFunction(() =>
    sessionStorage.getItem("upd:last-browsing-page")?.includes("q=beach"),
  );
  await page.goto(`/place/${hidden.id}/`);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForURL(
    (url) =>
      url.pathname === `/area/${area}/` &&
      url.searchParams.get("q") === "beach",
  );
  for (const width of [375, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const back = page.locator(".area-navigation__back");
    await expect(back).toBeVisible();
    expect((await back.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await page.locator("header").first().boundingBox())!.height - 1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const trigger = page.getByRole("button", {
      name: "Open menu",
      exact: true,
    });
    await trigger.click();
    const menu = page.getByRole("dialog", {
      name: "Explore Unlock Paradise",
      exact: true,
    });
    expect(
      await menu.evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  expect(
    (await request.get(base + `/api/previews/${randomUUID()}/`)).status(),
  ).toBe(404);
  expect(
    (await request.get(base + `/api/v1/places/${hidden.id}/`)).status(),
  ).toBe(403);
  const locked = await (
    await request.get(base + `/api/v1/places/${hidden.id}/`)
  ).json();
  expect(JSON.stringify(locked)).not.toMatch(
    /latitude|longitude|object_path|access_points/,
  );
});

test("release edge: profile persistence and tablet/phone layout retain reachable actions", async ({
  page,
  context,
}) => {
  await signIn(context, "explorerplus2@paradise.com");
  await page.goto("/account/");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit profile",
    exact: true,
  });
  const field = editor.getByLabel("Name", { exact: true });
  const original = await field.inputValue();
  try {
    await field.fill("Synthetic profile check");
    await editor
      .getByRole("button", { name: "Save name", exact: true })
      .click();
    await expect(
      editor.getByRole("button", { name: "Save name", exact: true }),
    ).toBeDisabled();
    await editor
      .getByRole("button", { name: "Close Edit profile", exact: true })
      .click();
    await page.reload();
    await expect(page.locator(".upd-profile__name")).toContainText(
      "Synthetic profile check",
    );
    for (const width of [375, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole("button", { name: "Edit profile", exact: true })
        .click();
      const savePreferences = editor.getByRole("button", {
        name: "Save preferences",
        exact: true,
      });
      await savePreferences.scrollIntoViewIfNeeded();
      await expect(savePreferences).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/client-todo/profile-editor-bottom-${width}.png`,
        animations: "disabled",
      });
      await editor
        .getByRole("button", { name: "Close Edit profile", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Edit profile", exact: true }),
      ).toBeVisible();
    }
  } finally {
    expect(
      (
        await context.request.patch(base + "/api/v1/me/", {
          headers: origin,
          data: { display_name: original },
        })
      ).ok(),
    ).toBe(true);
  }
});

test("release edge: destination directions use distinct points and discovery omits sharing", async ({
  page,
  context,
}) => {
  await signIn(context, "explorerplus2@paradise.com");
  const catalog = (
    await (await context.request.get(base + "/api/v1/planning-places/")).json()
  ).data;
  const place = catalog.find(
    (p: { accessPoints: unknown[]; coordinates: unknown }) =>
      p.accessPoints.length && p.coordinates,
  );
  expect(place).toBeTruthy();
  await page.goto(`/place/${place.slug}/`);
  const access = page.getByRole("region", {
    name: "Getting there",
    exact: true,
  });
  const destination = access;
  await expect(
    access
      .getByRole("link", {
        name: `Open ${place.accessPoints[0].name} in Maps`,
        exact: true,
      })
      .first(),
  ).toHaveAttribute(
    "href",
    new RegExp(
      `query=${place.accessPoints[0].latitude},${place.accessPoints[0].longitude}`,
    ),
  );
  await expect(
    destination.getByRole("link", {
      name: "Open destination in Maps",
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    new RegExp(`query=${place.coordinates[1]},${place.coordinates[0]}`),
  );
  await expect(access).not.toContainText(
    String(place.accessPoints[0].latitude),
  );
  await expect(access).not.toContainText(String(place.coordinates[1]));
  await shot(page, "destination-directions");
  const preferences = (
    await (await context.request.get(base + "/api/v1/traveler/")).json()
  ).data;
  let sentSharing: boolean | undefined;
  await page.route("**/api/v1/traveler/", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    sentSharing = route.request().postDataJSON().answers.public_badges;
    await route.fulfill({
      json: { data: { ...preferences, status: "completed" } },
    });
  });
  await page.goto("/traveler-discovery/");
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Find my traveler type", exact: true })
    .click();
  await expect(page.locator(".td-result h1")).toBeVisible();
  await expect(page.locator(".td-result .traveler-nameplate")).toHaveCount(1);
  await expect(page.locator(".td-result .traveler-badges")).toHaveCount(0);
  await expect(page.locator(".td-result a")).toHaveCount(1);
  expect(sentSharing).toBe(preferences?.public_badges || false);
  await shot(page, "discovery-result");
});

test("area scope: creation requires one area and the saved route stays at the map corner", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await signIn(context, "explorerplus2@paradise.com");
  const choices = (
    await (
      await context.request.get(
        base + "/api/v1/planning-places/?search=Tagkawayan",
      )
    ).json()
  ).data;
  const place = choices[0];
  const areaId = place.areaIds[0];
  const rejected = await context.request.post(base + "/api/v1/itineraries/", {
    headers: origin,
    data: {
      title: "[TEST] Area required",
      notes: "",
      start_date: null,
      end_date: null,
      day_count: 1,
    },
  });
  expect(rejected.status()).toBe(400);
  await page.goto("/itineraries/?create=1");
  const field = page.getByRole("combobox", { name: /^Trip area/ });
  await expect(field).toBeEnabled();
  await page
    .getByLabel("Trip name", { exact: true })
    .fill("[TEST] Area scope itinerary");
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  expect(await field.locator("option").count()).toBe(5);
  await field.selectOption(areaId);
  await shot(page, "trip-area");
  const made = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/itineraries/") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  const response = await made;
  expect(response.ok()).toBe(true);
  let trip = (await response.json()).data as Trip;
  try {
    expect(trip.area_id).toBe(areaId);
    const saved = await context.request.patch(
      `${base}/api/v1/itineraries/${trip.id}/`,
      {
        headers: origin,
        data: {
          version: trip.version,
          action: "add",
          payload: {
            day_id: trip.itinerary_days[0].id,
            place_id: place.id,
            start_time: "08:00",
            end_time: "10:00",
          },
        },
      },
    );
    expect(saved.ok()).toBe(true);
    trip = (await saved.json()).data;
    await page.unroute("https://api.mapbox.com/**");
    await page.goto(`/itineraries/?trip=${trip.id}`);
    await page
      .getByRole("button", { name: "Add destination", exact: true })
      .click();
    await expect(page.locator("#find-destinations select")).toHaveCount(0);
    await page.getByRole("button", { name: "My route", exact: true }).click();
    await expect(page.locator(".p2-planning-map .p2-map-feedback")).toHaveCount(
      0,
      { timeout: 30000 },
    );
    const geometry = await page.locator(".p2-planning-map").evaluate((host) => {
      const map = host.getBoundingClientRect(),
        list = host.querySelector(".p2-map-browser")!.getBoundingClientRect();
      return { top: list.top - map.top, left: list.left - map.left };
    });
    expect(geometry.top).toBeLessThanOrEqual(12);
    expect(geometry.left).toBeLessThanOrEqual(12);
    await shot(page, "route-loaded");
  } finally {
    const current = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
    );
    if (current.ok()) {
      trip = (await current.json()).data;
      expect(trip.title).toBe("[TEST] Area scope itinerary");
      expect(
        (
          await context.request.delete(
            `${base}/api/v1/itineraries/${trip.id}/`,
            { headers: origin, data: { version: trip.version } },
          )
        ).ok(),
      ).toBe(true);
    }
  }
});

test("image delivery: About crop, storefront pictures and private originals remain usable", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/about/");
  const photo = page
    .locator(".upd-about__plate")
    .filter({ has: page.locator('img[src*="IMG_5678"]') });
  await photo.scrollIntoViewIfNeeded();
  await expect(photo.locator("img")).toBeVisible();
  await expect
    .poll(() =>
      photo
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  const geometry = await photo.evaluate((el) => {
    const figure = el.getBoundingClientRect(),
      image = el.querySelector("img")!.getBoundingClientRect();
    return {
      cropped: image.top < figure.top - 40,
      ratio: figure.height / figure.width,
      fade: getComputedStyle(el, "::after").backgroundImage,
    };
  });
  expect(geometry.cropped).toBe(true);
  expect(geometry.ratio).toBeLessThan(1.4);
  expect(geometry.fade).toContain("linear-gradient");
  await shot(page, "about-cropped");
  await page.goto("/merch/");
  const picture = page.locator(".p2-product-card img").first();
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await shot(page, "merch-optimized");
  await signIn(context, "explorerplus2@paradise.com");
  const catalog = (
    await (await context.request.get(base + "/api/v1/planning-places/")).json()
  ).data;
  const privatePlace = catalog.find((p: { image?: string }) => p.image);
  const route = new URL(privatePlace.image, base);
  route.searchParams.set("width", "640");
  const image = await context.request.get(route.toString());
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toMatch(/^image\//);
  // Authenticated image delivery must still make the same RLS decision for guests.
  const unoptimized = new URL(privatePlace.image, base);
  const guestOriginal = await request.get(unoptimized.toString(), {
    maxRedirects: 0,
  });
  const guestOptimized = await request.get(route.toString(), {
    maxRedirects: 0,
  });
  expect(guestOptimized.status()).toBe(guestOriginal.status());
});
