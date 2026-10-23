import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { createHmac, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
type TestIdentity = {
  email: string;
  password: string;
  factor?: { id: string; secret: string };
};
// UI/API sign-in is covered by staging acceptance. Repeated UI fixtures obtain real
// Auth sessions directly so reruns do not consume the application's login throttle.
async function authenticate(context: BrowserContext, user: TestIdentity) {
  const cookieJar = new Map<string, string>();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
        setAll: (values) =>
          values.forEach((c) => cookieJar.set(c.name, c.value)),
      },
    },
  );
  const signed = await db.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signed.error) throw new Error("Synthetic Auth sign-in failed.");
  if (user.factor) {
    const verified = await db.auth.mfa.challengeAndVerify({
      factorId: user.factor.id,
      code: totp(user.factor.secret),
    });
    if (verified.error) throw new Error("Synthetic MFA verification failed.");
  }
  await context.addCookies(
    [...cookieJar].map(([name, value]) => ({
      name,
      value,
      url: base,
      sameSite: "Lax" as const,
    })),
  );
}
function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(
    (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1e6)
    .toString()
    .padStart(6, "0");
}
async function ready(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.updReady === "true",
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
}

test("all six homepage categories navigate, filter, and support browser history", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  for (const slug of [
    "beaches",
    "rivers",
    "islands",
    "waterfalls",
    "mountain-hikes",
    "others",
  ]) {
    const chip = page.locator(`.upd-cat-chip[href="/place_category/${slug}/"]`);
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/place_category/${slug}/`));
    await expect(page.locator(".upd-card").first()).toBeVisible();
    await noOverflow(page);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".upd-cat-chip")).toHaveCount(6);
    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/place_category/${slug}/`));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
  }
});
test("guest planner action preserves intent and Bucketlist drawer restores keyboard focus", async ({
  page,
}) => {
  await page.goto("/place_category/beaches/");
  await ready(page);
  await page.locator("[data-add-itinerary]").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in to continue" }),
  ).toHaveAttribute("href", /add_place/);
  await page.keyboard.press("Escape");
  const floating = page.getByRole("button", {
    name: /^Open Bucketlist/,
  });
  await floating.click();
  await expect(
    page.getByRole("dialog", { name: "My Bucketlist", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(floating).toBeFocused();
});
test("contact and sign-in forms explain invalid fields without native bubbles", async ({
  page,
}) => {
  for (const path of ["/contact/", "/login/"]) {
    await page.goto(path);
    await ready(page);
    const form = page.locator("form[data-endpoint]");
    await form
      .getByRole("button", {
        name: path === "/contact/" ? "Send message" : "Sign in",
        exact: true,
      })
      .click();
    await expect(form.locator(".p2-form-summary")).toBeVisible();
    await expect(form.locator("[aria-invalid=true]").first()).toBeFocused();
    await expect(form).toHaveAttribute("novalidate", "");
  }
});

test("merch preserves variants, quantities and cart on reload with honest checkout", async ({
  page,
}) => {
  await page.goto("/merch/products/whats-it-gonna-be-tee/");
  await ready(page);
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(
    page.getByRole("status").or(page.locator(".p2-notices")),
  ).toContainText("added to your cart");
  const floatingCart = page.getByRole("link", {
    name: "Open shopping cart 2 items",
    exact: true,
  });
  await expect(floatingCart).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Open Bucketlist/ }),
  ).toHaveCount(0);
  await floatingCart.click();
  await expect(page.locator(".p2-cart-item")).toHaveCount(1);
  await expect(page.getByRole("spinbutton")).toHaveValue("2");
  await page.reload();
  await expect(page.getByRole("spinbutton")).toHaveValue("2");
  await page.getByRole("spinbutton").fill("3");
  await page.reload();
  await expect(page.getByRole("spinbutton")).toHaveValue("3");
  await page.getByRole("link", { name: "View ordering status" }).click();
  await expect(
    page.getByRole("heading", { name: "Ordering opens soon." }),
  ).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await page.getByRole("link", { name: "Return to your cart" }).click();
  await page.getByRole("button", { name: /Remove What's/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your cart is ready when you are." }),
  ).toBeVisible();
  await page.goto("/merch/");
  await ready(page);
  await expect(
    page.getByRole("link", { name: "Open shopping cart 0 items", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".p2-merch")
      .evaluate(
        (root) =>
          new Set(
            [...root.querySelectorAll("h1, h2, h3")].map(
              (heading) => getComputedStyle(heading).fontFamily,
            ),
          ).size,
      ),
  ).toBe(1);
  await noOverflow(page);
  const issues = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(issues.violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/phase2/merch-refined-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test.describe("live Supabase Phase 2", () => {
  test.describe.configure({ mode: "serial", timeout: 90000 });
  let premium: BrowserContext, admin: BrowserContext, explorer: BrowserContext;
  let boat: { id: string; slug: string; title: string },
    mountain: { id: string; slug: string; title: string };
  const createdTrips: string[] = [];
  const explorerTrips: string[] = [];
  const syntheticPlaces: { id: string; body: Record<string, unknown> }[] = [];
  async function api(
    context: BrowserContext,
    path: string,
    method = "GET",
    data?: unknown,
  ) {
    const response = await context.request.fetch(base + path, {
      method,
      headers: { Origin: base },
      data,
    });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(
      true,
    );
    return response.json();
  }
  test.beforeAll(async ({ browser }, info) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL,
      "Live backend is not configured.",
    );
    const fixtures = JSON.parse(
      await readFile("artifacts/staging-private/identities.json", "utf8"),
    );
    for (const role of ["premium", "admin", "explorer"]) {
      const context = await browser.newContext();
      const user = fixtures.users[role];
      await authenticate(context, user);
      if (role === "premium") premium = context;
      else if (role === "explorer") explorer = context;
      else {
        admin = context;
      }
    }
    const tax = await api(admin, "/api/admin/taxonomy/");
    for (const kind of ["boat", "mountain"]) {
      const slug = `synthetic-phase2-${kind}-${randomUUID()}`;
      const body = {
        title: `[TEST] Phase 2 ${kind} ${info.project.name} ${slug.slice(-8)}`,
        slug,
        status: "publish",
        vip_content: false,
        premium_content: false,
        listing_types: ["destination"],
        travel_minutes: 99,
        accessibility:
          kind === "boat" ? ["Car", "Boat"] : ["Motorcycle", "Car", "Hike"],
        assets: [],
        featured: false,
        feature_order: 0,
        description:
          '<h3>Original field notes</h3><p>Synthetic destination for testing only.</p><p><a href="https://unlockparadise.ph/">Source credit</a></p><script>alert(1)</script>',
        content: "",
        excerpt: "Synthetic test destination.",
        latitude: kind === "boat" ? 9.85 : 10.1,
        longitude: 118.75,
        weekday_crowd: "",
        weekend_crowd: "",
        area_ids: [tax.areas[0].id],
        category_ids: [
          tax.categories.find(
            (c: { slug: string }) =>
              c.slug === (kind === "boat" ? "beaches" : "mountain-hikes"),
          ).id,
        ],
        gallery: [],
        cover_id: null,
        boat_required: kind === "boat",
        departure_port: kind === "boat" ? "Synthetic test port" : null,
        road_minutes: kind === "boat" ? 20 : null,
        boat_minutes: kind === "boat" ? 35 : null,
        hike_minutes: kind === "mountain" ? 90 : null,
        travel_notes: "Synthetic verified metadata for testing only.",
        transport_minutes: { Car: 25, Motorcycle: 20 },
      };
      const result = await api(admin, "/api/admin/places/", "POST", body);
      syntheticPlaces.push({ id: result.id, body });
      if (kind === "boat") boat = { id: result.id, slug, title: body.title };
      else mountain = { id: result.id, slug, title: body.title };
    }
    await api(admin, `/api/admin/recommendations/${boat.id}/`, "POST", {
      items: [{ place_id: mountain.id, type: "Test recommendation" }],
    });
  });
  test.afterAll(async () => {
    // A separate acceptance run can revoke a synthetic identity's refresh token.
    // Renew cleanup-only sessions so one signed-out fixture cannot strand records.
    for (const [context, role] of [
      [premium, "premium"],
      [explorer, "explorer"],
    ] as const) {
      if (context && !(await context.request.get(base + "/api/v1/me/")).ok()) {
        const user = JSON.parse(
          await readFile("artifacts/staging-private/identities.json", "utf8"),
        ).users[role];
        await authenticate(context, user);
      }
    }
    if (premium)
      for (const id of createdTrips) {
        const r = await premium.request.get(
          base + `/api/v1/itineraries/${id}/`,
        );
        if (r.ok()) {
          const { data } = await r.json();
          await api(premium, `/api/v1/itineraries/${id}/`, "DELETE", {
            version: data.version,
          });
        }
      }
    if (premium)
      for (const p of syntheticPlaces)
        for (const op of ["unsave", "unvisit"])
          await api(premium, "/api/v1/bucketlist/", "POST", {
            place_id: p.id,
            op,
          });
    for (const id of explorerTrips) {
      const result = await api(explorer, `/api/v1/itineraries/${id}/`);
      await api(explorer, `/api/v1/itineraries/${id}/`, "DELETE", {
        version: result.data.version,
      });
    }
    if (admin && boat?.id)
      await api(admin, `/api/admin/recommendations/${boat.id}/`, "POST", {
        items: [],
      });
    if (admin)
      for (const p of syntheticPlaces) {
        await api(admin, `/api/admin/places/${p.id}/`, "PATCH", {
          ...p.body,
          status: "archived",
        });
        await api(admin, `/api/admin/places/${p.id}/`, "DELETE", {
          confirm_slug: p.body.slug,
        });
      }
    await premium?.close();
    await explorer?.close();
    await admin?.close();
  });
  test.beforeEach(async ({ context }) => {
    await context.addCookies((await premium.storageState()).cookies);
  });
  test("account layout fills the desktop frame and keeps settings and cards usable", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/account/");
    await ready(page);
    const bounds = await page.locator(".upd-member-page").boundingBox();
    expect(bounds!.width).toBeGreaterThan(isMobile ? 300 : 1100);
    const header = await page.locator(".upd-profile__id").boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(64);
    await page.getByRole("button", { name: "Change profile photo" }).click();
    await expect(
      page.getByRole("dialog", { name: "Profile photo", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Change profile photo" }),
    ).toBeFocused();
    await page
      .locator(".upd-profile__row")
      .filter({ hasText: "Display name" })
      .locator("summary")
      .click();
    await expect(
      page.getByRole("textbox", { name: "Display name", exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLImageElement>(".upd-card img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    await page.screenshot({
      path: `artifacts/phase2/account-refined-${test.info().project.name}.png`,
      fullPage: true,
    });
    const issues = await new AxeBuilder({ page })
      .disableRules(["region"])
      .analyze();
    expect(issues.violations).toEqual([]);
  });
  test("first trip is created directly inside the planner without a dashboard", async ({
    page,
    context,
    isMobile,
  }) => {
    await context.clearCookies();
    await context.addCookies((await explorer.storageState()).cookies);
    expect((await api(explorer, "/api/v1/itineraries/")).data).toHaveLength(0);
    await page.goto("/itineraries/");
    await ready(page);
    await expect(
      page.getByRole("heading", {
        name: "Plan your first Palawan trip.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".p2-trip-grid")).toHaveCount(0);
    await noOverflow(page);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/phase21/first-trip-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .getByLabel("Trip name", { exact: true })
      .fill("Phase 2.1 first Explorer trip");
    await page.getByLabel("Start date", { exact: true }).fill("2026-11-01");
    await page.getByLabel("End date", { exact: true }).fill("2026-11-02");
    await page
      .getByRole("button", { name: "Create trip", exact: true })
      .click();
    await page.waitForURL((url) => !!url.searchParams.get("trip"));
    explorerTrips.push(new URL(page.url()).searchParams.get("trip")!);
    await expect(
      page.getByRole("heading", {
        name: "Phase 2.1 first Explorer trip",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Find destinations", exact: true }),
    ).toBeVisible();
    if (isMobile) {
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      await expect(
        page
          .getByRole("navigation", { name: "Mobile", exact: true })
          .getByRole("link", { name: "Itinerary Planner", exact: true }),
      ).toHaveAttribute("href", "/itineraries/");
      await page.keyboard.press("Escape");
    } else {
      await expect(
        page
          .getByRole("navigation", { name: "Primary", exact: true })
          .getByRole("link", { name: "Itinerary Planner", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  });
  test("unified planner switches trips, preserves deep links, guards drafts and creates in place", async ({
    page,
    isMobile,
  }) => {
    const body = { notes: "", day_count: 2, start_date: null, end_date: null };
    const a = (
      await api(premium, "/api/v1/itineraries/", "POST", {
        ...body,
        title: "Phase 2.1 trip A",
      })
    ).data;
    const b = (
      await api(premium, "/api/v1/itineraries/", "POST", {
        ...body,
        title: "Phase 2.1 trip B",
      })
    ).data;
    createdTrips.push(a.id, b.id);
    await api(premium, `/api/v1/itineraries/${a.id}/`, "PATCH", {
      version: a.version,
      action: "add",
      payload: { day_id: a.itinerary_days[0].id, place_id: boat.id },
    });
    await page.goto("/itineraries/");
    await ready(page);
    await expect(
      page.getByRole("heading", { name: a.title, exact: true }),
    ).toBeVisible();
    const switcher = page.getByRole("combobox", {
      name: "Switch trip",
      exact: true,
    });
    await expect(switcher).toHaveValue(a.id);
    await expect(page.locator(".p2-trip-grid")).toHaveCount(0);
    await switcher.selectOption(b.id);
    await expect(
      page.getByRole("heading", { name: b.title, exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("trip")).toBe(b.id);
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: a.title, exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("heading", { name: b.title, exact: true }),
    ).toBeVisible();
    await page.goto(`/itineraries/${a.id}/?day=${a.itinerary_days[1].id}`);
    await ready(page);
    expect(new URL(page.url()).pathname).toBe("/itineraries/");
    expect(new URL(page.url()).searchParams.get("day")).toBe(
      a.itinerary_days[1].id,
    );
    await expect(
      page.getByRole("button", { name: /Day 2.*0 stops/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Day 1.*1 stops?/ }).click();
    const draft = page.getByRole("textbox", {
      name: "Notes for this stop",
      exact: true,
    });
    await draft.fill("Unsaved note must survive Cancel.");
    await switcher.selectOption(b.id);
    await expect(
      page.getByRole("dialog", { name: "Confirm action", exact: true }),
    ).toContainText("Discard unsaved stop notes");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(switcher).toHaveValue(a.id);
    await expect(draft).toHaveValue("Unsaved note must survive Cancel.");
    await switcher.selectOption(b.id);
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: b.title, exact: true }),
    ).toBeVisible();
    expect(
      (await api(premium, `/api/v1/itineraries/${a.id}/`)).data.items[0].notes,
    ).toBe("");
    await page.getByRole("button", { name: "+ New trip", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Create a new trip", exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: b.title, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ New trip", exact: true }).click();
    await page
      .getByLabel("Trip name", { exact: true })
      .fill("Phase 2.1 created in planner");
    await page
      .getByRole("button", { name: "Create trip", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Phase 2.1 created in planner",
        exact: true,
      }),
    ).toBeVisible();
    const created = new URL(page.url()).searchParams.get("trip")!;
    createdTrips.push(created);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit trip", exact: true }).click();
    await page
      .getByLabel("Trip name", { exact: true })
      .fill("Phase 2.1 renamed in planner");
    await page
      .getByRole("button", { name: "Save trip details", exact: true })
      .click();
    await expect(switcher.locator(`option[value="${created}"]`)).toHaveText(
      "Phase 2.1 renamed in planner",
    );
    await noOverflow(page);
    if (!isMobile) {
      for (const width of [922, 1024, 1920, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await noOverflow(page);
      }
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/phase21/workspace-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Delete itinerary", exact: true })
      .click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/itineraries/" && !url.searchParams.has("trip"),
    );
    await expect(switcher).not.toHaveValue(created);
    expect(
      (
        await premium.request.get(base + `/api/v1/itineraries/${created}/`)
      ).status(),
    ).toBe(404);
    createdTrips.splice(createdTrips.indexOf(created), 1);
  });
  test("persistent Bucketlist drawer, labels, tooltips, filters and failure feedback", async ({
    page,
  }) => {
    await page.goto(`/place/${boat.slug}/`);
    await ready(page);
    const save = page.getByRole("button", {
      name: "Add to Bucketlist",
      exact: true,
    });
    await save.focus();
    await expect(page.getByRole("tooltip")).toContainText("Add to Bucketlist");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await save.click();
    await expect(
      page.getByRole("button", { name: "Remove from Bucketlist", exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await api(premium, "/api/v1/bucketlist/")).data.some(
          (r: { place_id: string }) => r.place_id === boat.id,
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: /Open Bucketlist/ }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: boat.title }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/bucketlist/");
    await ready(page);
    await page.getByLabel("Search saved Places").fill(boat.title);
    await expect(page.locator(".p2-saved-card")).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: boat.title })).toBeVisible();
    await page.route("**/api/v1/bucketlist/", async (route) => {
      if (route.request().method() === "POST")
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Synthetic network failure; please retry.",
          }),
        });
      else await route.continue();
    });
    await page.locator(`button[data-place-uuid="${boat.id}"]`).click();
    await expect(page.locator(".p2-notices")).toContainText(
      "Synthetic network failure",
    );
    await expect(page.getByRole("heading", { name: boat.title })).toBeVisible();
    await page.unroute("**/api/v1/bucketlist/");
    await page.locator(`button[data-place-uuid="${boat.id}"]`).click();
    await expect(page.getByRole("heading", { name: boat.title })).toHaveCount(
      0,
    );
  });
  test("itinerary UI creates, searches, selects map Places, reorders, moves and persists notes", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/itineraries/new/");
    await ready(page);
    await page.getByLabel("Trip name").fill("Phase 2 browser trip");
    await page.getByLabel("Start date", { exact: true }).fill("2026-11-01");
    await page.getByLabel("End date", { exact: true }).fill("2026-11-03");
    await page
      .getByRole("button", { name: "Create trip", exact: true })
      .click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/itineraries/" && !!url.searchParams.get("trip"),
    );
    const id = new URL(page.url()).searchParams.get("trip")!;
    createdTrips.push(id);
    await page
      .getByRole("button", { name: "+ Add Place", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search destinations", exact: true })
      .fill(boat.title);
    const finder = page.getByRole("region", {
      name: "Find destinations",
      exact: true,
    });
    await expect(
      finder.getByRole("link", { name: /Explore main map/ }),
    ).toHaveAttribute("href", "/#palawan-map");
    await finder
      .getByLabel("Category", { exact: true })
      .selectOption({ label: "Beaches" });
    await expect(finder.locator(".p2-search-results li")).toHaveCount(1);
    await page
      .getByRole("button", { name: `Add ${boat.title} to Day 1`, exact: false })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(page.locator(".p2-stop")).toHaveCount(1);
    await expect(
      finder.getByRole("button", {
        name: `${boat.title} is already in Day 1`,
        exact: false,
      }),
    ).toBeDisabled();
    await finder.getByLabel("Category", { exact: true }).selectOption("");
    await page
      .getByRole("button", { name: "+ Add Place", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search destinations", exact: true })
      .fill(mountain.title);
    await page.getByRole("button", { name: "Explore Our Map" }).click();
    const searchDialog = page.getByRole("complementary", {
      name: "Selected day map",
      exact: true,
    });
    await searchDialog
      .getByRole("group", { name: "Choose an area", exact: true })
      .getByRole("button")
      .first()
      .click();
    await searchDialog.locator(".category-btn").first().click();
    await searchDialog.locator(".p2-map-marker").first().click();
    await expect(searchDialog.locator(".p2-map-preview")).toContainText(
      mountain.title,
    );
    await searchDialog
      .getByRole("button", { name: "Close Place preview" })
      .click();
    await searchDialog
      .getByText("Map locations — keyboard and touch list")
      .click();
    await searchDialog
      .locator(".p2-map-list")
      .getByRole("button", { name: mountain.title, exact: true })
      .click();
    await searchDialog.getByRole("button", { name: /^Add to Day 1/ }).click();
    await expect(page.locator(".p2-stop")).toHaveCount(2);
    if (isMobile)
      await searchDialog
        .getByRole("button", { name: "Search by name", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Search by Name", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search destinations", exact: true })
      .fill("");
    await finder
      .getByLabel("Area", { exact: true })
      .selectOption({ label: "Puerto North" });
    await expect(finder.getByRole("status")).toContainText(
      "matching destinations",
    );
    await finder.getByLabel("Area", { exact: true }).selectOption("");
    await page.evaluate(() => window.scrollTo(0, 0));
    const issues = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(issues.violations).toEqual([]);
    await page.screenshot({
      path: `artifacts/phase2/planner-finder-${test.info().project.name}.png`,
      fullPage: true,
    });
    if (!isMobile) {
      await page
        .locator("[data-drag-handle]")
        .first()
        .dragTo(page.locator(".p2-stop").last());
      await expect(page.locator(".p2-stop").first()).toContainText(
        mountain.title,
      );
      await page
        .getByRole("button", { name: `Move ${boat.title} up`, exact: true })
        .click();
      await expect(page.locator(".p2-stop").first()).toContainText(boat.title);
    }
    await page
      .getByRole("button", { name: `Move ${mountain.title} up`, exact: true })
      .click();
    await expect(page.locator(".p2-stop").first()).toContainText(
      mountain.title,
    );
    await page
      .locator(".p2-stop")
      .first()
      .getByLabel("Notes for this stop")
      .fill("Remember my camera.");
    await page
      .locator(".p2-stop")
      .first()
      .getByRole("button", { name: "Save note", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await api(premium, `/api/v1/itineraries/${id}/`)).data.items.find(
            (i: { place_id: string }) => i.place_id === mountain.id,
          ).notes,
      )
      .toBe("Remember my camera.");
    await page
      .locator(".p2-stop")
      .first()
      .getByRole("combobox", { name: /Move to another day/ })
      .selectOption({ label: "Day 2" });
    await page.getByRole("button", { name: /Day 2.*1 stops?/ }).click();
    await expect(page.locator(".p2-stop")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".p2-stop")).toContainText(mountain.title);
    await expect(page.getByLabel("Notes for this stop")).toHaveValue(
      "Remember my camera.",
    );
    await page.getByRole("button", { name: "Edit trip", exact: true }).click();
    await page.getByLabel("Trip name").fill("Phase 2 edited trip");
    await page
      .getByRole("button", { name: "Save trip details", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Phase 2 edited trip", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/phase2/planner-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Delete itinerary", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "Phase 2 edited trip", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete itinerary", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page.waitForURL(/\/itineraries\/$/);
    createdTrips.splice(createdTrips.indexOf(id), 1);
  });
  test("cross-site Add to Itinerary persists separately from Bucketlist and rejects other owners", async ({
    page,
  }) => {
    const trip = (
      await api(premium, "/api/v1/itineraries/", "POST", {
        title: "Cross-site test",
        notes: "",
        start_date: "2026-11-02",
        end_date: "2026-11-04",
        day_count: 3,
      })
    ).data;
    createdTrips.push(trip.id);
    await page.goto(`/place/${boat.slug}/`);
    await ready(page);
    await page.locator("[data-add-itinerary]").first().click();
    await page.getByLabel("Trip", { exact: true }).selectOption(trip.id);
    await page.getByRole("button", { name: "Add Place", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Your next stop is planned." }),
    ).toBeVisible();
    const persisted = (await api(premium, `/api/v1/itineraries/${trip.id}/`))
      .data;
    await expect(
      page.getByRole("link", { name: "Open planner", exact: true }),
    ).toHaveAttribute(
      "href",
      `/itineraries/?trip=${trip.id}&day=${trip.itinerary_days[0].id}`,
    );
    await api(premium, "/api/v1/bucketlist/", "POST", {
      place_id: mountain.id,
      op: "save",
    });
    await page.getByRole("link", { name: "Open planner", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: trip.title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".p2-stop")).toHaveCount(1);
    await page.getByRole("button", { name: /^Open Bucketlist/ }).click();
    await page
      .getByRole("dialog")
      .locator(".p2-saved-card")
      .filter({ hasText: mountain.title })
      .getByRole("button", { name: "Add to Itinerary", exact: true })
      .click();
    await expect(page.getByLabel("Trip", { exact: true })).toHaveValue(trip.id);
    await expect(page.getByLabel("Day", { exact: true })).toHaveValue(
      trip.itinerary_days[0].id,
    );
    await page.getByRole("button", { name: "Add Place", exact: true }).click();
    await page
      .getByRole("button", { name: "Keep exploring", exact: true })
      .click();
    await expect(page.locator(".p2-stop")).toHaveCount(2);
    await page.getByRole("button", { name: "+ Add day", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api(premium, `/api/v1/itineraries/${trip.id}/`)).data
            .itinerary_days.length,
      )
      .toBe(4);
    expect(persisted.items[0].place_id).toBe(boat.id);
    expect(
      (await api(premium, "/api/v1/bucketlist/")).data.some(
        (r: { place_id: string }) => r.place_id === boat.id,
      ),
    ).toBe(false);
    expect(
      (
        await explorer.request.get(base + `/api/v1/itineraries/${trip.id}/`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await explorer.request.patch(base + `/api/v1/itineraries/${trip.id}/`, {
          headers: { Origin: base },
          data: {
            version: persisted.version,
            action: "remove",
            payload: { item_id: persisted.items[0].id },
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await premium.request.patch(base + `/api/v1/itineraries/${trip.id}/`, {
          headers: { Origin: base },
          data: {
            version: 1,
            action: "remove",
            payload: { item_id: persisted.items[0].id },
          },
        })
      ).status(),
    ).toBe(409);
  });
  test("planner failure keeps the selected day and can retry", async ({
    page,
  }) => {
    const trip = (
      await api(premium, "/api/v1/itineraries/", "POST", {
        title: "Failure recovery test",
        notes: "",
        day_count: 2,
        start_date: null,
        end_date: null,
      })
    ).data;
    createdTrips.push(trip.id);
    await page.goto(`/itineraries/${trip.id}/`);
    await ready(page);
    await page
      .getByRole("button", { name: "+ Add Place", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search destinations", exact: true })
      .fill(boat.title);
    await page.route(`**/api/v1/itineraries/${trip.id}/`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Synthetic planner outage. Please retry.",
            }),
          })
        : route.continue(),
    );
    await page
      .getByRole("button", { name: `Add ${boat.title} to Day 1`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    const finder = page.getByRole("region", {
      name: "Find destinations",
      exact: true,
    });
    await expect(page.getByRole("dialog")).toContainText(
      "Synthetic planner outage",
    );
    await expect(finder).toBeVisible();
    await page.unroute(`**/api/v1/itineraries/${trip.id}/`);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(page.locator(".p2-stop")).toHaveCount(1);
  });

  test("boat/hike metadata, sanitized guides and curated recommendations render", async ({
    page,
  }) => {
    await page.goto(`/place/${boat.slug}/`);
    await ready(page);
    await expect(
      page.getByRole("region", { name: "Journey by road and boat" }),
    ).toContainText("Travel by road: 20 min");
    await expect(
      page.getByRole("region", { name: "Journey by road and boat" }),
    ).toContainText("Boat ride: 35 min");
    await expect(page.locator(".p2-guide-copy").first()).toContainText(
      "Original field notes",
    );
    await expect(page.locator(".p2-guide-copy script")).toHaveCount(0);
    await expect(page.locator(".p2-guide-copy a")).toHaveAttribute(
      "href",
      "https://unlockparadise.ph/",
    );
    await expect(page.locator(".p2-recommendations")).toContainText(
      mountain.title,
    );
    await page.goto(`/place/${mountain.slug}/`);
    await ready(page);
    await expect(page.locator(".upd-place-details")).toContainText("Hike time");
    await expect(page.locator(".upd-place-details")).toContainText("90 min");
    await expect(page.locator(".upd-place-details")).not.toContainText(
      "99 min",
    );
    await expect(
      page.locator('.upd-place-details [aria-label^="Hike"]'),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Car — 25 min", exact: true })
      .focus();
    await expect(page.getByRole("tooltip")).toContainText("Car — 25 min");
  });
  test("destination gallery opens, advances and closes by keyboard", async ({
    page,
  }) => {
    await page.goto("/place/100-cafe-moto/");
    await ready(page);
    const gallery = page.locator(".upd-gallery");
    await expect(gallery).toHaveAttribute("data-gallery-ready", "true");
    await gallery.locator(".swiper-slide-active a").first().click();
    await expect(page.locator(".glightbox-container")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.locator(".glightbox-container")).toHaveCount(0);
  });

  test("admin travel editor and recommendation management save real records", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addCookies((await admin.storageState()).cookies);
    await page.goto("/admin/");
    await ready(page);
    await page.goto("/admin/?section=places");
    await page.getByLabel("Search Places", { exact: true }).fill(boat.title);
    await page
      .getByRole("button", { name: `Edit ${boat.title}`, exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Edit Place", exact: true }),
    ).toBeVisible();
    await page.getByText("Travel information", { exact: true }).click();
    await page.getByLabel("City to port by road (minutes)").fill("21");
    await page.getByRole("button", { name: "Save Place", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Places", exact: true }),
    ).toBeVisible();
    const updated = await api(admin, `/api/admin/places/${boat.id}/`);
    expect(Number(updated.data[0].place_details.road_minutes)).toBe(21);
    await page
      .getByRole("button", { name: `Edit ${boat.title}`, exact: true })
      .first()
      .click();
    const section = page.locator(".p2-admin-recommendations");
    await expect(section).toContainText(mountain.title);
    await section
      .getByLabel("Recommendation label (optional)")
      .fill("A test day out");
    await section.getByRole("button", { name: "Save recommendations" }).click();
    await expect
      .poll(
        async () =>
          (await api(admin, `/api/admin/recommendations/${boat.id}/`)).data[0]
            .type,
      )
      .toBe("A test day out");
    await page.screenshot({
      path: `artifacts/phase2/admin-editor-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
  test("member pages and planner have no automated accessibility violations", async ({
    page,
  }) => {
    for (const path of [
      "/itineraries/",
      "/itineraries/new/",
      "/bucketlist/",
      "/visited/",
      `/place/${boat.slug}/`,
    ]) {
      await page.goto(path);
      await ready(page);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        path,
      ).toEqual([]);
    }
  });
  test("account menu supports keyboard and real logout", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/account/");
    await ready(page);
    if (isMobile)
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
    const trigger = page
      .locator(".p2-account summary")
      .filter({ visible: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(
      page
        .getByRole("navigation", { name: "Account", exact: true })
        .filter({ visible: true }),
    ).toContainText("Itinerary Planner");
    await page
      .getByRole("button", { name: "Log Out", exact: true })
      .filter({ visible: true })
      .click();
    await page.waitForURL(base + "/");
    expect((await page.request.get(base + "/api/v1/me/")).status()).toBe(401);
  });
});
