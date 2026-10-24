import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { stagingIdentity } from "./helpers/staging-auth";
import type { TravelPlace } from "../src/lib/planning";

const base = "http://127.0.0.1:3000";
async function ready(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.updReady === "true",
  );
}
async function audit(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  const directory = name.startsWith("planner-")
    ? "artifacts/planner-map-placement/after"
    : "artifacts/account-planner-refinement/after";
  await mkdir(directory, {
    recursive: true,
  });
  await page.screenshot({
    path: `${directory}/${name}-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
}

test("branded registration validates confirmation, keeps readable text and retains input after failure", async ({
  page,
  request,
}) => {
  await page.goto("/join/");
  await ready(page);
  const form = page.locator(".p2-auth-form");
  await expect(page.locator(".p2-auth-brand")).toContainText("Unlock Paradise");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page
    .getByLabel("Email", { exact: true })
    .fill("example@example.invalid");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  expect(
    await page
      .getByLabel("Email", { exact: true })
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(244, 244, 235)");
  await page
    .getByLabel("Password", { exact: true })
    .fill("A unique long passphrase");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("A different passphrase");
  await page.getByRole("checkbox").check();
  const show = page.getByRole("button", { name: "Show password", exact: true });
  await expect(show.locator("svg")).toBeVisible();
  expect((await show.textContent())?.trim()).toBe("");
  await show.click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  expect(
    await page
      .getByLabel("Email", { exact: true })
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe("rgb(244, 244, 235)");
  await audit(page, "register");
  let submissions = 0;
  await page.route("**/api/auth/join/", async (route) => {
    submissions++;
    expect(route.request().postDataJSON().confirm_password).toBe(
      "A unique long passphrase",
    );
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Registration is temporarily unavailable. Try again.",
      }),
    });
  });
  await form
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(form).toContainText("Passwords do not match");
  expect(submissions).toBe(0);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("A unique long passphrase");
  await form
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "example@example.invalid",
  );
  await expect(
    form.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  expect(submissions).toBe(1);
  for (const body of [
    { password: "A unique long passphrase" },
    {
      password: "A unique long passphrase",
      confirm_password: "does not match",
    },
    { password: "short123", confirm_password: "short123" },
  ]) {
    const response = await request.post(`${base}/api/auth/join/`, {
      headers: { Origin: base },
      data: { email: "example@example.invalid", terms: true, ...body },
    });
    expect(response.status()).toBe(400);
  }
});

test("sign-in uses icon profile navigation and a real member session", async ({
  page,
}, info) => {
  await page.goto("/login/?redirect_to=/account/");
  await ready(page);
  if (info.project.name.includes("mobile"))
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
  const summary = page.locator("summary[aria-label='Profile']:visible");
  await expect(summary.locator("svg")).toBeVisible();
  expect((await summary.textContent())?.trim()).toBe("");
  await summary.click();
  await expect(
    page.getByRole("link", { name: "Register", exact: true }),
  ).toBeVisible();
  await summary.press("Escape");
  if (info.project.name.includes("mobile")) await page.keyboard.press("Escape");
  const fixture = JSON.parse(
    await readFile("artifacts/staging-private/identities.json", "utf8"),
  );
  expect(fixture.project).toBe("iitblbdqztuxdzpaetie");
  await page
    .getByLabel("Email", { exact: true })
    .fill(fixture.users.premium.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(fixture.users.premium.password);
  await audit(page, "sign-in");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account\//);
  await ready(page);
  if (info.project.name.includes("mobile"))
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(
    page.locator("summary[aria-label='Profile']:visible .p2-avatar"),
  ).toBeVisible();
});

test("admin collection filter remains present with one collection and persists in the URL", async ({
  page,
  context,
}) => {
  await stagingIdentity(context, "admin");
  await page.goto("/admin/?section=merchandise");
  await ready(page);
  const filter = page.getByRole("combobox", {
    name: "Collection",
    exact: true,
  });
  await expect(filter).toBeVisible();
  await expect(
    filter.getByRole("option", {
      name: "Unlock Paradise Collection",
      exact: true,
    }),
  ).toHaveCount(1);
  await filter.focus();
  await filter.press("Alt+ArrowDown");
  await page.screenshot({
    path: `artifacts/account-planner-refinement/after/collection-popup-${page.viewportSize()!.width}.png`,
  });
  await page.keyboard.press("Escape");
  const collection = await filter
    .getByRole("option", { name: "Unlock Paradise Collection", exact: true })
    .getAttribute("value");
  await filter.selectOption(collection!);
  await expect(page).toHaveURL(/collection=/);
  await expect(page.locator(".studio-load")).not.toContainText(
    "Loading records",
  );
  await page.reload();
  await expect(filter).toHaveValue(collection!);
  await audit(page, "admin-collection");
  const filtered = await context.request.get(
    `${base}/api/admin/merchandise/?collection=${collection}`,
  );
  const value = await filtered.json();
  expect(filtered.status()).toBe(200);
  expect(value.count).toBeGreaterThan(0);
  expect(
    value.data.every(
      (p: { collection_id: string }) => p.collection_id === collection,
    ),
  ).toBe(true);
  const empty = await context.request.get(
    `${base}/api/admin/merchandise/?collection=${randomUUID()}`,
  );
  expect((await empty.json()).count).toBe(0);
});

test("mini homepage map browses area, category and real destinations without leaving the planner", async ({
  page,
  context,
}) => {
  await stagingIdentity(context, "premium");
  const created = await context.request.post(`${base}/api/v1/itineraries/`, {
    headers: { Origin: base },
    data: {
      title: `[TEST] Mini map ${randomUUID()}`,
      notes: "Temporary acceptance fixture",
      day_count: 2,
      start_date: null,
      end_date: null,
    },
  });
  expect(created.status()).toBe(201);
  const trip = (await created.json()).data;
  try {
    const catalog = await context.request.get(
      `${base}/api/v1/planning-places/`,
    );
    expect(catalog.status()).toBe(200);
    const place: TravelPlace = (await catalog.json()).data.find(
      (p: TravelPlace) => p.coordinates && p.area && p.category,
    );
    expect(place).toBeTruthy();
    const area = place.area.split(" · ")[0],
      category = place.category.split(" · ")[0];
    await page.goto(`/itineraries/?trip=${trip.id}`);
    await ready(page);
    await page
      .getByRole("button", { name: "Explore options", exact: true })
      .click();
    const mini = page.getByRole("region", {
      name: "Explore the planner map",
      exact: true,
    });
    const panel = page.getByRole("complementary", {
      name: "Selected day map",
      exact: true,
    });
    await expect(
      panel.getByRole("region", {
        name: "Explore the planner map",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".p2-destination-finder .p2-mini-map"),
    ).toHaveCount(0);
    await mini
      .getByRole("group", { name: "Choose an area", exact: true })
      .getByRole("button", { name: area, exact: true })
      .click();
    await expect(
      mini.getByRole("heading", { name: area, exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    await audit(page, "planner-area-categories");
    await mini
      .locator(".category-btn")
      .filter({ hasText: category })
      .first()
      .click();
    await mini.locator(".p2-map-list summary").click();
    await mini
      .locator(".p2-map-list")
      .getByRole("button", { name: place.title, exact: true })
      .click();
    await expect(mini.locator(".p2-map-preview")).toContainText(place.title);
    await audit(page, "planner-destination");
    await page.route(
      `**/api/v1/itineraries/${trip.id}/`,
      (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Save unavailable. Try again." }),
            })
          : route.continue(),
      { times: 1 },
    );
    await mini
      .getByRole("button", { name: "Add to Day 1", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(page.locator(".p2-notice--error")).toContainText(
      "Save unavailable",
    );
    await expect(mini.locator(".p2-map-preview")).toContainText(place.title);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(
      mini.getByRole("button", { name: "Added to this day", exact: true }),
    ).toBeDisabled();
    const saved = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
    );
    expect(
      (await saved.json()).data.items.map(
        (i: { place_id: string }) => i.place_id,
      ),
    ).toEqual([place.id]);
    await page.getByRole("button", { name: /Day 2.*0 stops?/ }).click();
    await expect(
      mini.getByRole("button", { name: "Add to Day 2", exact: true }),
    ).toBeEnabled();
    await mini
      .getByRole("button", { name: "Add to Day 2", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(
      mini.getByRole("button", { name: "Added to this day", exact: true }),
    ).toBeDisabled();
    await panel
      .getByRole("button", { name: "My route (1)", exact: true })
      .click();
    await expect(panel.locator(".p2-mini-map")).toHaveCount(0);
    await expect(panel.locator(".p2-map-caption")).toContainText(
      "1 mapped Place",
    );
    await panel
      .getByRole("button", { name: "Explore destinations", exact: true })
      .click();
    await mini
      .getByRole("group", { name: "Choose an area", exact: true })
      .getByRole("button", { name: area, exact: true })
      .click();
    await mini
      .locator(".category-btn")
      .filter({ hasText: category })
      .first()
      .click();
    await mini
      .getByRole("button", { name: `Back to ${area} categories`, exact: true })
      .click();
    await expect(
      mini.getByRole("heading", { name: area, exact: true }),
    ).toBeVisible();
  } finally {
    const latest = await context.request.get(
      `${base}/api/v1/itineraries/${trip.id}/`,
    );
    expect(
      (
        await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
          headers: { Origin: base },
          data: { version: (await latest.json()).data.version },
        })
      ).ok(),
    ).toBe(true);
  }
});
