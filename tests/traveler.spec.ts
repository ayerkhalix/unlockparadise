import { test as base, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { temporaryTraveler, travelerService } from "./helpers/traveler-fixture";
import { stagingIdentity } from "./helpers/staging-auth";
import { emptyAnswers } from "../src/lib/traveler";
base.use({ trace: "off", video: "off" });
base.setTimeout(120000);
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
type Traveler = Awaited<ReturnType<typeof temporaryTraveler>>;
const test = base.extend<{ traveler: Traveler }>({
  traveler: async ({ context }, runFixture) => {
    const user = await temporaryTraveler(context);
    try {
      await runFixture(user);
    } finally {
      await user.cleanup();
    }
  },
});
const ready = async (page: Page) => {
  await page.waitForFunction(
    () => document.documentElement.dataset.updReady === "true",
  );
  await page.getByText("Loading your progress…").waitFor({ state: "hidden" });
  if (new URL(page.url()).pathname.startsWith("/traveler-discovery"))
    await expect(page.locator('[data-flight-target="bucketlist"]')).toHaveCount(
      0,
    );
};
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await ready(page);
}
const current = async (page: Page) =>
  (await (await page.request.get("/api/v1/traveler/")).json()).data;
async function save(page: Page, answers = emptyAnswers) {
  const before = await current(page);
  const response = await page.request.put("/api/v1/traveler/", {
    headers: { Origin: origin },
    data: { op: "complete", version: before?.version || 0, answers },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}
async function stepsToEnd(page: Page) {
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("complete discovery, restore an interrupted draft, edit identity and personalize Featured", async ({
  page,
  traveler,
}) => {
  await open(page, "/traveler-discovery/");
  await ready(page);
  await page.getByRole("checkbox", { name: /Beaches & Islands/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /Slow & Easy/ }).check();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "What’s your kind of perfect day?" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /Slow & Easy/ })).toBeChecked();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Beaches & Islands/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /Scenic Moments/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "Partner", exact: true }).check();
  await expect(
    page.getByRole("checkbox", { name: /Show my traveler badges/ }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(
    page.getByRole("heading", { name: "Coastal Wanderer", exact: true }),
  ).toBeVisible();
  const persisted = await current(page);
  expect(persisted.user_id).toBe(traveler.id);
  expect(persisted.interests).toEqual(["beach"]);
  expect(persisted.public_badges).toBe(false);
  await page.getByRole("link", { name: "Explore my picks" }).click();
  await expect(page.locator(".td-featured-reason").first()).toBeVisible();
  expect(
    await page.locator("#featured .upd-fcard-chip").allTextContents(),
  ).toEqual(expect.arrayContaining([expect.stringMatching(/Beach|Island/)]));
  await open(page, "/account/");
  await expect(
    page.getByRole("heading", { name: "Coastal Wanderer" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit Travel Preferences" }).click();
  await ready(page);
  await expect(
    page.getByRole("checkbox", { name: /Beaches & Islands/ }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: /Beaches & Islands/ }).uncheck();
  await page.getByRole("checkbox", { name: /Mountain Explorer/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /Full Adventure/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /Outdoor Challenges/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(
    page.getByRole("heading", { name: "Highland Culture Seeker", exact: true }),
  ).toBeVisible();
  await open(page, "/");
  await expect(page.locator("#featured .upd-fcard-name").first()).toBeVisible();
  await expect(
    page.locator("#featured .td-featured-reason").first(),
  ).toContainText("mountains");
});

test("new authenticated login invites once; skip and existing-user dismissal persist without loops", async ({
  page,
  context,
  traveler,
}) => {
  await context.clearCookies();
  let login = await page.request.post("/api/auth/login/", {
    headers: { Origin: origin },
    data: {
      email: traveler.email,
      password: traveler.password,
      redirect_to: "/account/",
    },
  });
  expect(login.status()).toBe(200);
  expect((await login.json()).redirect_to).toContain("/traveler-discovery/");
  await open(page, "/traveler-discovery/");
  await ready(page);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(origin + "/");
  expect((await current(page)).status).toBe("skipped");
  login = await page.request.post("/api/auth/login/", {
    headers: { Origin: origin },
    data: {
      email: traveler.email,
      password: traveler.password,
      redirect_to: "/account/",
    },
  });
  expect((await login.json()).redirect_to).toBe("/account/");
  // Absence represents an existing account: no migration backfill and no forced flow.
  expect(
    (
      await traveler.service
        .from("traveler_preferences")
        .delete()
        .eq("user_id", traveler.id)
    ).error,
  ).toBeNull();
  login = await page.request.post("/api/auth/login/", {
    headers: { Origin: origin },
    data: {
      email: traveler.email,
      password: traveler.password,
      redirect_to: "/account/",
    },
  });
  expect((await login.json()).redirect_to).toBe("/account/");
  await open(page, "/account/");
  await page.getByRole("link", { name: "Discover my travel style" }).hover();
  const invitationAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(invitationAccessibility.violations).toEqual([]);
  const dismissal = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/traveler/" &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  const dismissed = await dismissal;
  expect(dismissed.status()).toBe(200);
  expect((await dismissed.json()).data.status).toBe("dismissed");
  await expect(
    page.getByRole("heading", { name: "Discover your traveler type" }),
  ).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Discover your traveler type" }),
  ).toHaveCount(0);
  expect((await current(page)).status).toBe("dismissed");
  await open(page, "/traveler-discovery/?next=%2Faccount%2F");
  await ready(page);
  await stepsToEnd(page);
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(
    page.getByRole("heading", { name: "Explorer", exact: true }),
  ).toBeVisible();
  expect((await current(page)).interests).toEqual([]);
  await expect(
    page.getByRole("link", { name: "Explore my picks" }),
  ).toHaveAttribute("href", "/");
});

test("failed and stale saves keep answers, reject duplicate commits and recover explicitly", async ({
  page,
  traveler,
}) => {
  await open(page, "/traveler-discovery/");
  await ready(page);
  await page.getByRole("checkbox", { name: /Beaches & Islands/ }).check();
  await stepsToEnd(page);
  let requests = 0;
  await page.route("**/api/v1/traveler/", async (route) => {
    if (route.request().method() === "PUT") {
      requests++;
      await new Promise((r) => setTimeout(r, 200));
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic service interruption. Try again." },
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Find my traveler type" }).dblclick();
  await expect(page.locator(".td-form [role='alert']")).toContainText(
    "Your answers are still here",
  );
  expect(requests).toBe(1);
  expect((await current(page)).status).toBe("pending");
  await page.unroute("**/api/v1/traveler/");
  await save(page, { ...emptyAnswers, interests: ["coffee"] });
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(page.locator(".td-form [role='alert']")).toContainText(
    "changed",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Beaches & Islands/ }),
  ).toBeChecked();
  const pref = await traveler.service
    .from("traveler_preferences")
    .select("interests")
    .eq("user_id", traveler.id)
    .single();
  expect(pref.data?.interests).toEqual(["coffee"]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(
    page.getByRole("checkbox", { name: /Coffee/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Beaches & Islands/ }),
  ).not.toBeChecked();
});

test("review badges use current consent, current identity and existing moderation", async ({
  page,
  traveler,
}) => {
  const place = await traveler.service
    .from("places")
    .select("id,slug")
    .eq("status", "publish")
    .eq("slug", "magarwak-mountain")
    .order("slug")
    .limit(1)
    .single();
  expect(place.error).toBeNull();
  const response = await page.request.post("/api/v1/reviews/", {
    headers: { Origin: origin },
    data: {
      place_id: place.data!.id,
      rating: 5,
      title: "[TEST] Traveler discovery",
      body: "Synthetic traveler review, removed after verification.",
    },
  });
  expect(response.status()).toBe(201);
  const review = (await response.json()).data;
  expect(
    (
      await traveler.service
        .from("reviews")
        .update({ status: "pending" })
        .eq("id", review.id)
        .eq("user_id", traveler.id)
    ).error,
  ).toBeNull();
  await save(page, {
    ...emptyAnswers,
    interests: ["beach"],
    public_badges: true,
  });
  let reviews = await (
    await page.request.get(`/api/v1/reviews/?place_id=${place.data!.id}`)
  ).json();
  expect(
    reviews.data.find((r: { id: string }) => r.id === review.id)
      ?.traveler_identity,
  ).toBeUndefined();
  expect(
    (
      await traveler.service
        .from("reviews")
        .update({ status: "approved" })
        .eq("id", review.id)
        .eq("user_id", traveler.id)
    ).error,
  ).toBeNull();
  await open(page, `/place/${place.data!.slug}/`);
  const article = page
    .locator(".upd-review")
    .filter({ hasText: "[TEST] Traveler discovery" });
  await expect(article.locator(".td-badge--primary")).toBeVisible();
  expect(await article.locator(".td-badge").count()).toBeLessThanOrEqual(3);
  await save(page, {
    ...emptyAnswers,
    interests: ["mountain", "culture"],
    pace: "adventure",
    style: "outdoor",
    public_badges: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(article.locator(".td-badge--primary")).toContainText(
    "Highland Culture Seeker",
  );
  await expect(article.locator(".td-badge")).toHaveCount(3);
  await open(page, "/account/");
  await page.route("**/api/v1/traveler/", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic privacy save failure." },
      });
    else await route.continue();
  });
  await page.getByRole("checkbox", { name: /Show my traveler badges/ }).click();
  await expect(page.locator(".td-privacy [role='alert']")).toContainText(
    "previous sharing choice is unchanged",
  );
  await expect(
    page.getByRole("checkbox", { name: /Show my traveler badges/ }),
  ).toBeChecked();
  expect((await current(page)).public_badges).toBe(true);
  await page.unroute("**/api/v1/traveler/");
  await page
    .getByRole("checkbox", { name: /Show my traveler badges/ })
    .uncheck();
  await expect
    .poll(async () => (await current(page)).public_badges)
    .toBe(false);
  await open(page, `/place/${place.data!.slug}/`);
  await expect(article.locator(".td-badges")).toHaveCount(0);
  reviews = await (
    await page.request.get(`/api/v1/reviews/?place_id=${place.data!.id}`)
  ).json();
  expect(
    reviews.data.find((r: { id: string }) => r.id === review.id)
      ?.traveler_identity,
  ).toBeUndefined();
});

test("strict API validation, RLS, entitlements and safe redirect boundaries remain intact", async ({
  page,
  traveler,
  browser,
}) => {
  const invalid = [
    {
      op: "complete",
      version: 0,
      answers: { ...emptyAnswers, interests: ["admin"] },
    },
    { op: "complete", version: 0, answers: { ...emptyAnswers, premium: true } },
    { op: "skip", version: 0, user_id: randomUUID() },
  ];
  for (const data of invalid)
    expect(
      (
        await page.request.put("/api/v1/traveler/", {
          headers: { Origin: origin },
          data,
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await page.request.put("/api/v1/traveler/", {
        headers: { Origin: "https://untrusted.invalid" },
        data: { op: "skip", version: 0 },
      })
    ).status(),
  ).toBe(403);
  const otherContext = await browser.newContext();
  const other = await temporaryTraveler(otherContext, false);
  try {
    expect(
      (
        await other.db
          .from("traveler_preferences")
          .select("*")
          .eq("user_id", traveler.id)
      ).data,
    ).toEqual([]);
    const patch = await other.db
      .from("traveler_preferences")
      .update({ public_badges: true })
      .eq("user_id", traveler.id)
      .select();
    expect(patch.error).toBeNull();
    expect(patch.data).toEqual([]);
    const ranked = await other.db.rpc("traveler_featured", { max_results: 12 });
    expect(ranked.error).toBeNull();
    expect(ranked.data).toEqual([]);
    const pref = await other.db.rpc("save_traveler_preferences", {
      expected_version: 0,
      body: {
        op: "complete",
        answers: { ...emptyAnswers, interests: ["beach"] },
      },
    });
    expect(pref.error).toBeNull();
    const ordinary = await other.db.rpc("traveler_featured", {
      max_results: 12,
    });
    expect(ordinary.error).toBeNull();
    expect(
      ordinary.data.every(
        (p: { vip_content: boolean; status: string }) =>
          !p.vip_content && p.status === "publish",
      ),
    ).toBe(true);
    const access = await other.db.rpc("viewer_access");
    expect(access.data.premium).toBe(false);
    expect(
      (
        await otherContext.request.get(
          origin + "/api/admin/traveler-discovery/",
        )
      ).status(),
    ).toBe(403);
  } finally {
    await other.cleanup();
    await otherContext.close();
  }
  const guest = await browser.newContext();
  try {
    expect(
      (await guest.request.get(origin + "/api/v1/traveler/")).status(),
    ).toBe(401);
    await guest.newPage().then(async (p) => {
      await p.goto(origin + "/");
      await expect(p.locator(".td-featured-reason")).toHaveCount(0);
      await p.goto(origin + "/traveler-discovery/");
      await expect(p).toHaveURL(/\/login\//);
    });
  } finally {
    await guest.close();
  }
  await open(page, "/traveler-discovery/?next=https%3A%2F%2Funtrusted.invalid");
  await ready(page);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(origin + "/");
});

// Real Supabase confirmation without SMTP delivery; token stays out of traces/URLs in reports.
test("keyboard, reduced motion, offline retry and expired-session draft recovery", async ({
  page,
  context,
  traveler,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/traveler-discovery/");
  await ready(page);
  const beach = page.getByRole("checkbox", { name: /Beaches & Islands/ });
  await beach.focus();
  await page.keyboard.press("Space");
  await expect(beach).toBeChecked();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What’s your kind of perfect day?" }),
  ).toBeFocused();
  await page.getByRole("radio", { name: /Slow & Easy/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("radio", { name: /A Little of Both/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(page.locator(".td-form [role='alert']")).toContainText(
    "Your answers are still here",
  );
  await context.setOffline(false);
  await context.clearCookies();
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(page.locator(".td-form [role='alert']")).toContainText(
    "Sign in",
  );
  const login = await page.request.post("/api/auth/login/", {
    headers: { Origin: origin },
    data: { email: traveler.email, password: traveler.password },
  });
  expect(login.status()).toBe(200);
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Who do you usually explore with?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find my traveler type" }).click();
  await expect(page.locator(".td-result")).toBeVisible();
  expect(
    await page
      .locator(".td-result > .upd-icon")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect((await current(page)).interests).toEqual(["beach"]);
});

base.describe("confirmation integration", () => {
  base(
    "new signup confirmation establishes a session before discovery; token cannot be reused",
    async ({ page, context }) => {
      const service = travelerService(),
        email = `traveler-confirm-${randomUUID()}@example.invalid`,
        password = randomBytes(24).toString("base64url");
      const termsGuard = await context.request.post(
        origin + "/api/auth/join/",
        {
          headers: { Origin: origin },
          data: { email, password, confirm_password: password },
        },
      );
      expect(termsGuard.status()).toBe(400);
      const emailGuard = await context.request.post(
        origin + "/api/auth/join/",
        {
          headers: { Origin: origin },
          data: { email, password, confirm_password: password, terms: true },
        },
      );
      expect(emailGuard.status()).toBe(503); // This synthetic address is never in the staging delivery allowlist.
      const link = await service.auth.admin.generateLink({
        type: "signup",
        email,
        password,
      });
      expect(link.error).toBeNull();
      const id = link.data.user!.id;
      try {
        const failed = await context.request.post(origin + "/api/auth/login/", {
          headers: { Origin: origin },
          data: { email, password },
        });
        expect(failed.status()).toBe(401);
        const url =
          origin +
          `/auth/confirm/?type=signup&token_hash=${encodeURIComponent(link.data.properties!.hashed_token)}`;
        const confirmed = await context.request.get(url, { maxRedirects: 0 });
        expect(confirmed.status()).toBe(307);
        expect(confirmed.headers().location).toContain("/traveler-discovery/");
        await open(page, confirmed.headers().location);
        await ready(page);
        expect((await current(page)).status).toBe("pending");
        const repeated = await context.request.get(url, { maxRedirects: 0 });
        expect(repeated.headers().location).toContain("error=confirmation");
        await page.getByRole("button", { name: "Skip for now" }).click();
        await expect(page).toHaveURL(origin + "/account/");
      } finally {
        const deleted = await service.auth.admin.deleteUser(id);
        expect(deleted.error).toBeNull();
      }
    },
  );
});

test("five-width visual and accessibility matrix plus administrator scope", async ({
  page,
  traveler,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop-1440",
    "Capture the five-width matrix once.",
  );
  test.setTimeout(420000);
  const directory = "artifacts/traveler-discovery/after";
  await mkdir(directory, { recursive: true });
  const records: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const capture = async (id: string, scope?: string) => {
    for (const width of [375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      if (id === "existing-invitation" || id === "result")
        await page
          .getByRole("link", {
            name:
              id === "result" ? "Explore my picks" : "Discover my travel style",
          })
          .hover();
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      await (scope
        ? page.locator(scope).screenshot({
            path: `${directory}/${id}-${width}.png`,
            animations: "disabled",
          })
        : page.screenshot({
            path: `${directory}/${id}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          }));
      records.push({
        id,
        width,
        scope: scope || "document",
        overflow,
        violations: axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        errors: [...errors],
      });
      expect(overflow).toBe(false);
      expect(axe.violations).toEqual([]);
    }
  };
  try {
    await open(page, "/traveler-discovery/");
    await ready(page);
    await capture("interests");
    await page.getByRole("checkbox", { name: /Beaches & Islands/ }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await capture("pace");
    await page.getByRole("radio", { name: /Slow & Easy/ }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await capture("style");
    await page.getByRole("radio", { name: /Scenic Moments/ }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await capture("companions-private");
    await page.getByRole("radio", { name: "Friends", exact: true }).check();
    await page
      .getByRole("checkbox", { name: /Show my traveler badges/ })
      .check();
    await page.getByRole("button", { name: "Find my traveler type" }).click();
    await expect(
      page.getByRole("heading", { name: "Coastal Wanderer", exact: true }),
    ).toBeVisible();
    await capture("result");
    await open(page, "/account/");
    await capture("account");
    const reviewPlace = await traveler.service
      .from("places")
      .select("id,slug")
      .eq("status", "publish")
      .eq("slug", "magarwak-mountain")
      .order("slug")
      .limit(1)
      .single();
    const reviewResponse = await page.request.post("/api/v1/reviews/", {
      headers: { Origin: origin },
      data: {
        place_id: reviewPlace.data!.id,
        rating: 5,
        title: "[TEST] Traveler identity capture",
        body: "Synthetic review removed after visual verification.",
      },
    });
    expect(reviewResponse.status()).toBe(201);
    const rid = (await reviewResponse.json()).data.id;
    expect(
      (
        await traveler.service
          .from("reviews")
          .update({ status: "approved" })
          .eq("id", rid)
          .eq("user_id", traveler.id)
      ).error,
    ).toBeNull();
    await save(page, {
      ...emptyAnswers,
      interests: ["mountain", "culture"],
      pace: "adventure",
      style: "outdoor",
      public_badges: true,
    });
    await open(page, `/place/${reviewPlace.data!.slug}/`);
    await page.locator("#reviews").scrollIntoViewIfNeeded();
    await capture("review-badges", "#reviews");
    await save(page, {
      ...emptyAnswers,
      interests: ["beach"],
      pace: "slow",
      style: "scenic",
      companion: "friends",
      public_badges: true,
    });
    await open(page, "/");
    await page.locator("#featured").waitFor();
    await capture("personalized-home");
    await open(page, "/traveler-discovery/?next=%2Faccount%2F");
    await ready(page);
    await page
      .getByRole("button", { name: "Clear all travel preferences" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(page).toHaveURL(origin + "/account/");
    await capture("skipped-account");
    await traveler.service
      .from("traveler_preferences")
      .delete()
      .eq("user_id", traveler.id);
    await page.reload({ waitUntil: "domcontentloaded" });
    await capture("existing-invitation");
    await context.clearCookies();
    await stagingIdentity(context, "admin", false);
    await open(page, "/admin/mfa/");
    await expect(
      page.getByLabel("Six digit code", { exact: true }),
    ).toBeVisible();
    await context.clearCookies();
    await stagingIdentity(context, "admin");
    await open(page, "/admin/?section=analytics");
    await page
      .getByRole("heading", { name: "Traveler discovery", exact: true })
      .waitFor();
    await page.getByText(/Aggregate insights appear after at least/).waitFor();
    await capture("admin-dark");
    await page.getByRole("button", { name: /Switch to light theme/ }).click();
    await capture("admin-light");
    expect(errors).toEqual([]);
  } finally {
    await writeFile(
      `${directory}/results.json`,
      JSON.stringify(records, null, 2),
    );
  }
});
