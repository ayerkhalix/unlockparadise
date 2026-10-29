import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { signIn } from "./helpers/demo-session";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
});

test("auth password controls survive hydration and retain validation and entered values", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of ["login", "join"]) {
    let submissions = 0;
    await page.route(`**/api/auth/${route}/`, (request) => {
      submissions++;
      return request.fulfill({
        status: 503,
        json: { error: "Sign in is temporarily unavailable. Try again." },
      });
    });
    await page.goto(`/${route}/`);
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("A-test-passphrase-only");
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    await expect(password).toHaveAttribute("type", "text");
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await expect(password).toHaveAttribute("type", "password");
    if (route === "join") {
      await page
        .getByLabel("Confirm password", { exact: true })
        .fill("A-test-passphrase-only");
      await page
        .getByRole("button", { name: "Show confirmed password", exact: true })
        .click();
      await expect(
        page.getByLabel("Confirm password", { exact: true }),
      ).toHaveAttribute("type", "text");
    }
    await page
      .locator("form[data-endpoint]")
      .getByRole("button", {
        name: route === "login" ? "Sign in" : "Create account",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(password).toHaveValue("A-test-passphrase-only");
    expect(submissions).toBe(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".p2-auth-card")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("primary and account navigation identify the current page on desktop and phone", async ({
  page,
  context,
}, info) => {
  await page.goto("/merch/");
  const mobile =
    info.project.name.includes("mobile") || info.project.name.includes("phone");
  if (mobile)
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: mobile ? "Mobile" : "Primary",
    exact: true,
  });
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(
    nav.getByRole("link", { name: "Merch", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (mobile) {
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open menu", exact: true }),
    ).toBeFocused();
  }
  await signIn(context, "explorerplus2@paradise.com");
  await page.goto("/portfolio/");
  if (mobile)
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
  else {
    await page.locator(".p2-account > summary").focus();
    await page.keyboard.press("Enter");
  }
  const account = page.getByRole("navigation", {
    name: mobile ? "Mobile" : "Account",
    exact: true,
  });
  await expect(
    account.getByRole("link", { name: "My Portfolio", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("admin phone actions retain comfortable targets and the product editor stays reachable", async ({
  page,
  context,
}, info) => {
  await signIn(context, "unlockadmin@paradise.com");
  await page.goto("/admin/?section=places");
  const refresh = page.getByRole("button", { name: "Refresh", exact: true });
  await expect(refresh).toBeVisible();
  if (
    info.project.name.includes("mobile") ||
    info.project.name.includes("phone")
  )
    expect((await refresh.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.goto("/admin/?section=merchandise");
  const optionsResponse = await context.request.get(
    "/api/admin/catalog-options/",
  );
  expect(optionsResponse.ok()).toBe(true);
  const catalogOptions = await optionsResponse.json();
  let releaseOptions!: () => void;
  const pendingOptions = new Promise<void>((resolve) => {
    releaseOptions = resolve;
  });
  await page.route("**/api/admin/catalog-options/", async (route) => {
    await pendingOptions;
    await route.fulfill({ json: catalogOptions });
  });
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add product", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Product name", { exact: true })).toBeVisible();
  const brand = page.getByLabel("Brand", { exact: true });
  await expect(brand.locator("option:checked")).toHaveText("Loading brand…");
  await expect(brand).toBeDisabled();
  const selected = await brand.inputValue();
  releaseOptions();
  await expect(brand).toBeEnabled();
  const namedBrand = catalogOptions.brands.find(
    (option: { id: string }) => option.id === selected,
  );
  expect(namedBrand).toBeTruthy();
  await expect(brand.locator("option:checked")).toHaveText(namedBrand.name);
  const publish = page.getByRole("heading", { name: "Publish", exact: true });
  await publish.scrollIntoViewIfNeeded();
  await expect(publish).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("map controls remain tappable and attribution stays readable over imagery", async ({
  page,
}) => {
  await page.goto("/");
  const map = page.locator(".palawan-map-wrap").first();
  const attribution = map.getByRole("button", {
    name: "Toggle attribution",
    exact: true,
  });
  await expect(
    map.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await map.scrollIntoViewIfNeeded();
  for (const name of ["Zoom in", "Zoom out"]) {
    const size = await map
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(44);
    expect(size!.height).toBeGreaterThanOrEqual(44);
  }
  if (await attribution.count()) {
    const size = await attribution.boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(44);
    expect(size!.height).toBeGreaterThanOrEqual(44);
    await attribution.click();
    await expect(map.locator(".mapboxgl-ctrl-attrib")).toHaveClass(
      /mapboxgl-compact-show/,
    );
  }
  const audit = await new AxeBuilder({ page })
    .include(".palawan-map-wrap")
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});
