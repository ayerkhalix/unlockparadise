import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { stagingIdentity } from "./helpers/staging-auth";
test.use({ video: "on" });
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
async function ready(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.updReady === "true",
  );
}
async function savedCount(page: Page) {
  const count = page.locator('[data-flight-target="bucketlist"] b');
  await expect(count).toHaveText(/^\d+$/);
  await page.evaluate(() => document.fonts.ready);
  // Wait for fonts and the count's first animation frame before reading it.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return Number(await count.textContent());
}
async function pauseFlights(page: Page) {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains("p2-flight")) animation.pause();
      return animation;
    };
  });
}
async function inspectFlight(page: Page, kind: string, project: string) {
  const node = page.locator(`.p2-flight[data-flight-kind="${kind}"]`);
  await expect(node).toHaveCount(1);
  await expect(node).toHaveAttribute("data-flight-mode", "travel");
  const data = await node.evaluate((el) => {
    const a = el.getAnimations()[0];
    return {
      from: (el as HTMLElement).dataset.flightFrom!.split(",").map(Number),
      to: (el as HTMLElement).dataset.flightTo!.split(",").map(Number),
      duration: Number(a.effect!.getTiming().duration),
    };
  });
  expect(data.duration).toBeGreaterThanOrEqual(650);
  expect(data.duration).toBeLessThanOrEqual(900);
  const frames = [];
  const dir = `artifacts/phase3-1/motion/${project}-${kind}`;
  await mkdir(dir, { recursive: true });
  for (const ms of [0, 200, 400, 720]) {
    await node.evaluate((el, time) => {
      el.getAnimations()[0].currentTime = time;
    }, ms);
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    frames.push({
      ms,
      x: box!.x + box!.width / 2,
      y: box!.y + box!.height / 2,
      width: box!.width,
    });
    await page.screenshot({ path: `${dir}/${ms}.png`, animations: "allow" });
  }
  expect(
    Math.hypot(frames[0].x - data.from[0], frames[0].y - data.from[1]),
  ).toBeLessThan(2);
  const dx = data.to[0] - data.from[0],
    dy = data.to[1] - data.from[1];
  const deviation =
    Math.abs(
      dx * (frames[2].y - data.from[1]) - dy * (frames[2].x - data.from[0]),
    ) / Math.hypot(dx, dy);
  expect(deviation).toBeGreaterThan(8);
  expect(
    Math.hypot(frames[3].x - data.to[0], frames[3].y - data.to[1]),
  ).toBeLessThan(Math.hypot(dx, dy) * 0.3);
  await writeFile(
    `${dir}/measurements.json`,
    JSON.stringify({ ...data, frames, deviation }, null, 2),
  );
  await node.evaluate((el) => el.getAnimations()[0].play());
  await expect(node).toHaveCount(0);
}
test("persisted Bucketlist flight, failed save, retry and removal preserve real state", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  await stagingIdentity(context, "premium");
  await pauseFlights(page);
  await page.goto("/place_category/beaches/", {
    waitUntil: "domcontentloaded",
  });
  await ready(page);
  const initial = await savedCount(page);
  const pid = await page
    .locator('[data-member-op="save"]')
    .first()
    .getAttribute("data-place-uuid");
  expect(pid).toBeTruthy();
  const button = page.locator(
    `[data-place-uuid="${pid}"][data-member-op="save"]`,
  );
  await button.scrollIntoViewIfNeeded();
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/bucketlist/") && r.method() === "POST")
      requests++;
  });
  try {
    await page.route(
      "**/api/v1/bucketlist/",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Save unavailable. Please try again.",
          }),
        }),
      { times: 1 },
    );
    await button.click();
    await expect(page.locator(".p2-notice--error")).toBeVisible();
    await expect(page.locator(".p2-flight")).toHaveCount(0);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await inspectFlight(page, "bucketlist", info.project.name);
    const saved = page.locator(
      `[data-place-uuid="${pid}"][data-member-op="unsave"]`,
    );
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-flight-target="bucketlist"] b'),
    ).toHaveText(String(initial + 1));
    expect(requests).toBe(2);
    await saved.click();
    await expect(
      page.locator(`[data-place-uuid="${pid}"][data-member-op="save"]`),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.locator('[data-flight-target="bucketlist"] b'),
    ).toHaveText(String(initial));
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await expect(
      page.locator(`[data-place-uuid="${pid}"][data-member-op="save"]`),
    ).toHaveAttribute("aria-pressed", "false");
  } finally {
    await context.request.post(`${base}/api/v1/bucketlist/`, {
      headers: { Origin: base },
      data: { place_id: pid, op: "unsave" },
    });
  }
});
test("catalog and detail bag flights retain variants, rapid quantities and local persistence", async ({
  page,
}, info) => {
  await pauseFlights(page);
  await page.goto("/merch/");
  await ready(page);
  const card = page.locator(".p2-product-card").first();
  await card.getByRole("combobox").selectOption("M");
  await card.getByRole("button", { name: /^Add to cart:/ }).click();
  await inspectFlight(page, "bag", info.project.name);
  await expect(page.locator('[data-flight-target="bag"] b')).toHaveText("1");
  await page.goto("/merch/products/whats-it-gonna-be-tee/");
  await ready(page);
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await add.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(page.locator('[data-flight-target="bag"] b')).toHaveText("5");
  await expect(page.locator(".p2-flight")).toHaveCount(2);
  await page.setViewportSize({
    width: info.project.name.includes("mobile") ? 391 : 1441,
    height: 900,
  });
  await expect(page.locator(".p2-flight")).toHaveCount(0);
  await page.reload();
  await ready(page);
  await expect(page.locator('[data-flight-target="bag"] b')).toHaveText("5");
  const entries = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("unlock-paradise-cart") || "[]"),
  );
  expect(entries[0]).toMatchObject({ size: "M", quantity: 5 });
  await page.goto("/merch/checkout/");
  await expect(
    page.getByRole("heading", { name: "Ordering opens soon." }),
  ).toBeVisible();
});
test("hidden flight target stays local; reduced motion skips travel and still adds", async ({
  page,
}) => {
  await pauseFlights(page);
  await page.goto("/merch/products/whats-it-gonna-be-tee/");
  await ready(page);
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page
    .locator('[data-flight-target="bag"]')
    .evaluate((el) => ((el as HTMLElement).style.display = "none"));
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.locator(".p2-flight")).toHaveAttribute(
    "data-flight-mode",
    "local",
  );
  await page
    .locator(".p2-flight")
    .evaluate((el) => el.getAnimations()[0].finish());
  await expect(page.locator(".p2-flight")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .locator('[data-flight-target="bag"]')
    .evaluate((el) => ((el as HTMLElement).style.display = ""));
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.locator(".p2-flight")).toHaveCount(0);
  await expect(page.locator('[data-flight-target="bag"] b')).toHaveText("2");
});
test("navy default, keyboard theme toggle, SSR persistence and themed portal", async ({
  page,
  context,
}) => {
  await stagingIdentity(context, "admin");
  const response = await page.goto("/admin/", {
    waitUntil: "domcontentloaded",
  });
  await ready(page);
  expect(await response!.text()).toContain('data-admin-theme="dark"');
  const scope = page.locator(".app-theme");
  await expect(scope).toHaveAttribute("data-admin-theme", "dark");
  const toggle = page.getByRole("button", { name: "Switch to light theme" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(scope).toHaveAttribute("data-admin-theme", "light");
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(scope).toHaveAttribute("data-admin-theme", "light");
  const members = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/admin/users/",
  );
  await page.goto("/admin/?section=members", { waitUntil: "domcontentloaded" });
  expect((await members).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: /^Manage Staging/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Manage Staging/ })
    .first()
    .click();
  await expect(page.locator("dialog[open]")).toHaveAttribute(
    "data-admin-theme",
    "light",
  );
  expect(
    await page
      .locator("dialog[open]")
      .evaluate((el) => getComputedStyle(el).colorScheme),
  ).toBe("light");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.goto("/merch/", { waitUntil: "domcontentloaded" });
  await ready(page);
  await expect(scope).not.toHaveAttribute("data-admin-theme");
});
test("featured card anatomy, contact form and keyboard photo strips", async ({
  page,
  context,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ready(page);
  const inset = await page
    .locator(".upd-fcard-body")
    .first()
    .evaluate((el) => ({
      display: getComputedStyle(el).display,
      padding: parseFloat(getComputedStyle(el).paddingLeft),
    }));
  expect(inset.display).toBe("block");
  expect(inset.padding).toBeGreaterThanOrEqual(20);
  await page.goto("/contact/", { waitUntil: "domcontentloaded" });
  await ready(page);
  expect(
    await page
      .locator("textarea")
      .first()
      .evaluate((el) => getComputedStyle(el).resize),
  ).toBe("none");
  expect(
    await page
      .locator("select")
      .first()
      .evaluate((el) => getComputedStyle(el).colorScheme),
  ).toBe("dark");
  await stagingIdentity(context, "premium");
  await page.goto("/place_category/beaches/", {
    waitUntil: "domcontentloaded",
  });
  await ready(page);
  const strip = page.locator("[data-upd-strip]").first();
  await strip.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => strip.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(100);
  await page.keyboard.press("Home");
  await expect
    .poll(() => strip.evaluate((el) => el.scrollLeft))
    .toBeLessThan(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  ).toBe(true);
});

test("Bucketlist rapid clicks deduplicate, hidden target flourishes locally and reduced motion keeps state", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await stagingIdentity(context, "premium");
  await pauseFlights(page);
  await page.goto("/place_category/beaches/", {
    waitUntil: "domcontentloaded",
  });
  await ready(page);
  await savedCount(page);
  const pid = await page
    .locator('[data-member-op="save"]')
    .first()
    .getAttribute("data-place-uuid");
  expect(pid).toBeTruthy();
  const button = page.locator(
    `[data-place-uuid="${pid}"][data-member-op="save"]`,
  );
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/bucketlist/") && r.method() === "POST")
      requests++;
  });
  try {
    await button.scrollIntoViewIfNeeded();
    // Programmatic rapid clicks bypass Playwright's stable-position checks.
    // Center the source and let scroll/dock measurements settle before saving.
    await button.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page
      .locator('[data-flight-target="bucketlist"]')
      .evaluate((el) => ((el as HTMLElement).style.visibility = "hidden"));
    await button.evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator(".p2-flight")).toHaveAttribute(
      "data-flight-mode",
      "local",
    );
    expect(requests).toBe(1);
    await page
      .locator(".p2-flight")
      .evaluate((el) => el.getAnimations()[0].finish());
    const remove = page.locator(
      `[data-place-uuid="${pid}"][data-member-op="unsave"]`,
    );
    const removed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/bucketlist/" &&
        response.request().method() === "POST",
    );
    await remove.click();
    const removal = await removed;
    expect(removal.status()).toBe(200);
    expect((await removal.json()).data.saved).toBe(false);
    const save = page.locator(
      `[data-place-uuid="${pid}"][data-member-op="save"]`,
    );
    await expect(save).toBeEnabled();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .locator('[data-flight-target="bucketlist"]')
      .evaluate((el) => ((el as HTMLElement).style.visibility = ""));
    await save.click();
    await expect(
      page.locator(`[data-place-uuid="${pid}"][data-member-op="unsave"]`),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".p2-flight")).toHaveCount(0);
  } finally {
    await context.request.post(`${base}/api/v1/bucketlist/`, {
      headers: { Origin: base },
      data: { place_id: pid, op: "unsave" },
    });
  }
});

test("MFA stays narrow and phone shortcuts appear first", async ({
  page,
  context,
}, info) => {
  await stagingIdentity(context, "admin", false);
  await page.goto("/admin/mfa/");
  await ready(page);
  const content = await page.locator(".studio-auth-content").boundingBox();
  expect(content!.width).toBeLessThanOrEqual(560);
  const inset = await page
    .locator(".studio-auth-content")
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
  expect(inset).toBeGreaterThanOrEqual(20);
  await stagingIdentity(context, "admin");
  await page.goto("/admin/");
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Studio shortcuts" }),
  ).toBeVisible();
  if (info.project.name.includes("mobile")) {
    const shortcut = await page
      .getByRole("button", { name: "Add Place", exact: true })
      .boundingBox();
    expect(shortcut!.y + shortcut!.height).toBeLessThan(844);
  }
});

test("a planner deep link opens its initial dialog without hydration errors", async ({
  page,
  context,
}) => {
  await stagingIdentity(context, "premium");
  const created = await context.request.post(`${base}/api/v1/itineraries/`, {
    headers: { Origin: base },
    data: {
      title: "[TEST] Phase 3.1 dialog hydration",
      notes: "Temporary synthetic fixture",
      day_count: 1,
      start_date: null,
      end_date: null,
    },
  });
  expect(created.ok()).toBe(true);
  const trip = (await created.json()).data;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|server rendered/i.test(m.text()))
      errors.push(m.text());
  });
  try {
    await page.goto(`/itineraries/?trip=${trip.id}&create=1`);
    await ready(page);
    await expect(
      page.getByRole("dialog", { name: "Create a new trip" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const response = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
    );
    if (response.ok()) {
      const data = (await response.json()).data;
      expect(
        (
          await context.request.delete(
            `${base}/api/v1/itineraries/${trip.id}/`,
            { headers: { Origin: base }, data: { version: data.version } },
          )
        ).ok(),
      ).toBe(true);
    }
  }
});
