import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";

let authCookies: Awaited<
  ReturnType<import("@playwright/test").BrowserContext["cookies"]>
>;
async function settled(page: Page) {
  await expect(page.locator(".studio-load").getByRole("status")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page: Page, label: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  await mkdir("artifacts/admin-redesign", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/admin-redesign/${label}-${test.info().project.name}.png`,
    fullPage: !label.endsWith("editor"),
    animations: "disabled",
  });
}
async function navigate(page: Page, label: string) {
  const nav = page.getByRole("navigation", {
    name: "Admin Studio",
    exact: true,
  });
  if (test.info().project.name.includes("mobile"))
    await page.getByRole("button", { name: "Open studio menu" }).click();
  await nav.getByRole("link", { name: label, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Admin Studio", exact: true }),
  ).toHaveCount(0);
  await settled(page);
}

test.beforeAll(async ({ browser, baseURL }) => {
  if (
    ![
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://unlockparadise-staging.vercel.app",
    ].includes(new URL(baseURL!).origin)
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
    "Local demo credentials are required for Admin Studio verification.",
  );
  const account = fixture.accounts.find(
    (entry: { email: string }) => entry.email === "unlockadmin@paradise.com",
  );
  const cached = await readFile("artifacts/admin-redesign/session.json", "utf8")
    .then(JSON.parse)
    .catch(() => undefined);
  const context = await browser.newContext({ storageState: cached });
  await context.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  const page = await context.newPage();
  await page.goto(baseURL + "/admin/");
  if (new URL(page.url()).pathname === "/login/") {
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page
      .locator('form[data-endpoint="/api/auth/login/"] button[type="submit"]')
      .click();
  }
  await page.waitForURL((url) => url.pathname === "/admin/");
  authCookies = await context.cookies();
  await mkdir("artifacts/admin-redesign", { recursive: true });
  await writeFile(
    "artifacts/admin-redesign/session.json",
    JSON.stringify(await context.storageState()),
  );
  await context.close();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(authCookies);
});

test("collection desk uses real records and keeps both themes accessible", async ({
  page,
}) => {
  await page.goto("/admin/");
  await settled(page);
  await expect(
    page.getByRole("heading", { name: "Your studio", exact: true }),
  ).toBeVisible();
  const photos = page.locator(".studio-specimen");
  await expect(photos.first()).toBeVisible();
  await page.waitForFunction(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>(".studio-specimen-photo img"),
    )
      .filter((img) => img.getBoundingClientRect().height > 0)
      .every((img) => img.complete),
  );
  await expect(
    page.getByRole("heading", { name: "On your desk", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".studio-stats")).toHaveCount(0);
  if (test.info().project.name.includes("mobile")) {
    const layout = await page.evaluate(() => {
      const library = document.querySelector(".studio-library-preview")!;
      const actions = document.querySelector(".studio-desk-aside")!;
      const activity = document.querySelector(".studio-journal")!;
      const date = activity.querySelector("time");
      return {
        libraryY: library.getBoundingClientRect().top,
        actionsY: actions.getBoundingClientRect().top,
        activityY: activity.getBoundingClientRect().top,
        logicalOrder: Boolean(
          actions.compareDocumentPosition(activity) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        dateSize: date ? parseFloat(getComputedStyle(date).fontSize) : 11,
      };
    });
    expect(layout.libraryY).toBeLessThan(layout.actionsY);
    expect(layout.actionsY).toBeLessThan(layout.activityY);
    expect(layout.logicalOrder).toBe(true);
    expect(layout.dateSize).toBeGreaterThanOrEqual(11);
  }
  expect(
    (await new AxeBuilder({ page }).include(".studio").analyze()).violations,
  ).toEqual([]);
  await capture(page, "overview-dark");
  if (test.info().project.name.includes("mobile"))
    await page.getByRole("button", { name: "Open studio menu" }).click();
  await page
    .getByRole("button", { name: "Switch to light theme", exact: true })
    .click();
  if (test.info().project.name.includes("mobile"))
    await page.keyboard.press("Escape");
  await expect(
    page.locator('[data-admin-theme="light"]').first(),
  ).toBeVisible();
  await capture(page, "overview-light");
  expect(
    (await new AxeBuilder({ page }).include(".studio").analyze()).violations,
  ).toEqual([]);
  await page.reload();
  await expect(
    page.locator('[data-admin-theme="light"]').first(),
  ).toBeVisible();
});

test("all modules retain navigation, table scrolling, filters and clear selected states", async ({
  page,
}) => {
  await page.goto("/admin/");
  for (const label of [
    "Places",
    "Merchandise",
    "Orders & Sales",
    "Analytics",
    "Members",
    "Reviews",
    "Settings",
  ]) {
    await navigate(page, label);
    await expect(
      page.getByRole("heading", { name: label, exact: true, level: 1 }),
    ).toBeVisible();
    if (!test.info().project.name.includes("mobile"))
      await expect(
        page
          .getByRole("navigation", { name: "Admin Studio", exact: true })
          .getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (["Places", "Merchandise", "Settings"].includes(label))
      await capture(page, label.toLowerCase());
  }
  await navigate(page, "Places");
  await page
    .getByRole("searchbox", { name: "Search Places", exact: true })
    .fill("Tagkawayan");
  await expect(page).toHaveURL(/search=Tagkawayan/);
  await expect(
    page.locator('.admin-table[aria-label="Place library"] tbody'),
  ).toContainText("Tagkawayan");
  await page.getByRole("button", { name: "Clear Search Places" }).click();
  await page
    .getByRole("combobox", { name: "Statuses", exact: true })
    .selectOption("draft");
  await expect(
    page.locator('.admin-table[aria-label="Place library"] tbody'),
  ).not.toContainText("Tagkawayan");
  await expect(page).toHaveURL(/status=draft/);
});

test("long editors remain reachable and cancel preserves the library", async ({
  page,
}) => {
  await page.goto("/admin/?section=places&sort=title");
  await settled(page);
  await page.getByRole("button", { name: "Add Place", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add Place", exact: true }),
  ).toBeVisible();
  const savebar = page.locator(".studio-savebar");
  await savebar.scrollIntoViewIfNeeded();
  await expect(savebar).toBeVisible();
  await capture(page, "place-editor");
  await page
    .getByRole("button", { name: "Back to Places", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Places", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/sort=title/);
  await navigate(page, "Merchandise");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add product", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Product name", exact: true })
    .fill("Unsaved visual review");
  await page.locator(".studio-savebar").scrollIntoViewIfNeeded();
  await expect(page.locator(".studio-savebar")).toBeVisible();
  await capture(page, "product-editor");
  await page
    .getByRole("button", { name: "Back to Merchandise", exact: true })
    .click();
  const decision = page.getByRole("dialog");
  await expect(decision).toBeVisible();
  await decision.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Merchandise", exact: true, level: 1 }),
  ).toBeVisible();
});

test("loading and failures stay distinct; reduced motion removes entrance animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/admin/places/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Temporary visual-test outage" },
    }),
  );
  await page.goto("/admin/");
  await expect(
    page.getByText("The Place selection couldn’t be loaded.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Try Place selection again",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page
      .locator(".studio-content")
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.unroute("**/api/admin/places/**");
  await page
    .getByRole("button", { name: "Try Place selection again", exact: true })
    .click();
  await expect(page.locator(".studio-specimen").first()).toBeVisible();
  await page.route("**/api/admin/merchandise/**", (route) =>
    route.fulfill({ json: { data: [], count: 0 } }),
  );
  await navigate(page, "Merchandise");
  await expect(
    page.getByText(
      "No matching products. Add a product or clear the filters.",
      { exact: true },
    ),
  ).toBeVisible();
});
