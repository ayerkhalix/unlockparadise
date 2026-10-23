import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";

test("first-visit notice remembers essential-only and remains editable", async ({
  page,
}) => {
  let interestRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/interest/")) interestRequests++;
  });
  await page.goto("/merch/");
  const banner = page.getByRole("region", {
    name: "Cookies & privacy",
  });
  await expect(banner).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("upd-analytics-consent")),
  ).toBeNull();
  const dock = page.locator("body > .p2-floating");
  await expect(dock).toBeVisible();
  await expect
    .poll(async () => {
      const notice = await banner.boundingBox(),
        floating = await dock.boundingBox();
      return !!(notice && floating && floating.y + floating.height < notice.y);
    })
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir("artifacts/auth-privacy", { recursive: true });
  await page.screenshot({
    path: `artifacts/auth-privacy/cookie-notice-${test.info().project.name}.png`,
  });
  expect(
    (await new AxeBuilder({ page }).include(".p2-cookie-banner").analyze())
      .violations,
  ).toEqual([]);
  await banner.getByRole("button", { name: "Essential only" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("upd-analytics-consent")),
  ).toBe("off");
  await page
    .getByRole("button", { name: "Privacy preferences", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cookies & privacy" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Allow analytics", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("upd-analytics-consent")),
  ).toBe("allowed");
  expect(interestRequests).toBe(0); // Automation privacy protection still wins.
});

test("cookie preferences use the shared keyboard-accessible dialog and fail analytics off", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.goto("/login/");
  const banner = page.locator(".p2-cookie-banner");
  await banner.getByRole("button", { name: "Manage preferences" }).click();
  const dialog = page.getByRole("dialog", { name: "Cookies & privacy" });
  await expect(
    dialog.getByRole("button", { name: "Keep analytics off" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    banner.getByRole("button", { name: "Manage preferences" }),
  ).toBeFocused();
  await banner.getByRole("button", { name: "Allow analytics" }).click();
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Your browser cannot save" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Privacy preferences", exact: true })
    .click();
  await expect(dialog).toContainText("Current analytics preference: Off");
});

test("Google sign-in preserves checkout intent, pending size and email fallback on both forms", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  for (const route of ["login", "join"]) {
    await page.goto(`/${route}/?redirect_to=%2Fcheckout%2F`);
    const google = page.getByRole("button", { name: "Continue with Google" });
    await expect(google).toBeVisible();
    const before = await google.boundingBox();
    let submitted: Record<string, unknown> = {};
    await page.route("**/api/auth/google/", async (intercept) => {
      submitted = intercept.request().postDataJSON();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await intercept.fulfill({
        status: 503,
        json: {
          error:
            "Google sign-in is not available yet. Please use email and password.",
        },
      });
    });
    await google.click();
    await expect(
      page.getByRole("button", { name: "Connecting…" }),
    ).toBeDisabled();
    const during = await google.boundingBox();
    expect(during?.width).toBe(before?.width);
    expect(during?.height).toBe(before?.height);
    await expect(
      page.locator(".p2-google-auth").getByRole("alert"),
    ).toContainText("use email and password");
    expect(submitted.redirect_to).toBe("/checkout/");
    await expect(google).toBeEnabled();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    const alternate = page.locator(".p2-auth-alt a");
    await expect(alternate).toHaveAttribute(
      "href",
      new RegExp("redirect_to=%2Fcheckout%2F"),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/auth-privacy/${route}-${test.info().project.name}.png`,
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page }).include(".p2-auth-card").analyze())
        .violations,
    ).toEqual([]);
    await page.unroute("**/api/auth/google/");
  }
});

test("auth endpoints reject cross-origin starts and unbound callbacks without creating sessions", async ({
  request,
  page,
  baseURL,
}) => {
  const blocked = await request.post("/api/auth/google/", {
    headers: { origin: "https://attacker.invalid" },
    data: { redirect_to: "https://attacker.invalid" },
  });
  expect(blocked.status()).toBe(403);
  const consent = await request.post("/api/auth/complete-account/", {
    headers: { origin: new URL(baseURL!).origin },
    data: { terms: true, redirect_to: "/admin/" },
  });
  expect(consent.status()).toBe(401);
  const start = await request.post("/api/auth/google/", {
    headers: { origin: new URL(baseURL!).origin },
    data: { redirect_to: "/checkout/" },
  });
  if (start.status() === 200) {
    const target = new URL((await start.json()).redirect_to);
    expect(target.pathname).toBe("/auth/v1/authorize");
    expect(target.searchParams.get("provider")).toBe("google");
    expect(target.searchParams.get("code_challenge_method")).toBe("s256");
  } else {
    expect(start.status()).toBe(503);
    expect((await start.json()).error).toMatch(/Google sign-in/);
  }
  await page.goto("/auth/callback/?code=synthetic&flow=" + "a".repeat(48));
  await expect(page).toHaveURL(/\/login\/\?error=google/);
  await expect(page.getByRole("alert")).toContainText(
    "canceled or could not be completed",
  );
  expect(
    (await page.context().cookies()).filter((cookie) =>
      /^sb-.*-auth-token/.test(cookie.name),
    ),
  ).toHaveLength(0);
  await page.goto("/auth/complete-account/?next=https://attacker.invalid");
  await expect(page).toHaveURL(/\/login\/\?redirect_to=%2Faccount%2F/);
});

test("existing members can still sign in with email and sign out", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  if (
    ![
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://unlockparadise-staging.vercel.app",
    ].includes(origin)
  )
    throw new Error(
      "Demo credentials are restricted to the local preview and named staging site.",
    );
  const fixture = await readFile(
    "artifacts/deployment/demo-accounts.json",
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => null);
  test.skip(
    !fixture,
    "The local demo account file is needed for the existing-member regression check.",
  );
  const account = fixture.accounts.find(
    (entry: { email: string }) => entry.email === "explorerplus2@paradise.com",
  );
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.goto("/login/?redirect_to=%2Faccount%2F");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .locator('form[data-endpoint="/api/auth/login/"] button[type="submit"]')
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/account/");
  await expect(page).toHaveURL(/\/account\//);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  const response = await page.request.post("/api/auth/logout/", {
    headers: { origin },
    data: {},
  });
  expect(response.ok()).toBe(true);
  await page.goto("/login/");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
