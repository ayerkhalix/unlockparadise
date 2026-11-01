import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { signIn } from "./helpers/demo-session";
import type { TravelPlace } from "../src/lib/planning";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
test("review options are owner-only, edit safely and confirm deletion without footer controls or interest tags", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(150000);
  await mkdir("artifacts/review-options", { recursive: true });
  const email =
    process.env.REVIEW_TEST_EMAIL ||
    (test.info().project.name === "mobile-390"
      ? "explorerplus2@paradise.com"
      : "explorerplus1@paradise.com");
  await signIn(context, email);
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  const me = (await (await context.request.get("/api/v1/me/")).json()).data;
  const catalog: TravelPlace[] = (
    await (await context.request.get("/api/v1/planning-places/")).json()
  ).data;
  let place: TravelPlace | undefined;
  for (const p of catalog.filter((p) => !p.vip).slice(0, 15)) {
    const rows = (
      await (
        await context.request.get(`/api/v1/reviews/?place_id=${p.id}`)
      ).json()
    ).data;
    if (!rows.some((r: { user_id: string }) => r.user_id === me.id)) {
      place = p;
      break;
    }
  }
  expect(place).toBeTruthy();
  const title = `[TEST] Review controls ${Date.now()}`,
    edited = `${title} edited`;
  const headers = { Origin: base };
  const created = await context.request.post("/api/v1/reviews/", {
    headers,
    data: {
      place_id: place!.id,
      rating: 5,
      title,
      body: "Temporary review interface check.",
    },
  });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).data.id;
  const endpoint = `/api/v1/reviews/${id}/`;
  const latest = async () =>
    (
      (
        await (
          await context.request.get(`/api/v1/reviews/?place_id=${place!.id}`)
        ).json()
      ).data as {
        id: string;
        title: string;
        body: string;
        rating: number;
        updated_at: string;
        created_at: string;
      }[]
    ).find((r) => r.id === id);
  let removed = false;
  try {
    const before = (await latest())!;
    await page.goto(`/place/${place!.slug}/`);
    const review = page
      .locator(".upd-review")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    const options = review.locator(".review-options");
    const trigger = options.locator("summary");
    await expect(
      review.locator(".td-badge:not(.td-badge--primary)"),
    ).toHaveCount(0);
    await expect(
      review.getByRole("button", { name: "Delete review", exact: true }),
    ).toHaveCount(0);
    await trigger.click();
    await expect(
      options.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
    await expect(
      options.getByRole("button", { name: "Delete", exact: true }),
    ).toBeVisible();
    const cardBox = (await review.boundingBox())!,
      triggerBox = (await trigger.boundingBox())!;
    expect(triggerBox.x + triggerBox.width).toBeGreaterThan(
      cardBox.x + cardBox.width - 30,
    );
    expect(triggerBox.y - cardBox.y).toBeLessThan(25);
    await page.keyboard.press("Escape");
    await expect(options).not.toHaveAttribute("open", "");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await review.screenshot({
      path: `artifacts/review-options/${test.info().project.name}-menu.png`,
      animations: "disabled",
    });
    await options.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = page.getByRole("dialog", {
      name: "Edit review",
      exact: true,
    });
    await expect(
      editor.getByRole("textbox", { name: "Review title" }),
    ).toHaveValue(title);
    await editor.getByRole("textbox", { name: "Review title" }).fill(edited);
    await editor
      .getByRole("textbox", { name: "Your review" })
      .fill("Updated review text.");
    await editor.getByRole("button", { name: "4 stars", exact: true }).click();
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    const discard = page.getByRole("dialog", {
      name: "Confirm action",
      exact: true,
    });
    await expect(discard).toContainText("Discard your review changes?");
    await discard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      editor.getByRole("textbox", { name: "Your review" }),
    ).toHaveValue("Updated review text.");
    await page.route(`**${endpoint}`, (r) =>
      r.request().method() === "PATCH"
        ? r.fulfill({
            status: 503,
            json: { error: "Temporary update failure. Try again." },
          })
        : r.continue(),
    );
    await editor
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(editor.getByRole("status")).toContainText(
      "Temporary update failure",
    );
    await expect(
      editor.getByRole("textbox", { name: "Your review" }),
    ).toHaveValue("Updated review text.");
    await page.unroute(`**${endpoint}`);
    await editor
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    const after = (await latest())!;
    expect(after.title).toBe(edited);
    expect(after.rating).toBe(4);
    expect(after.created_at).toBe(before.created_at);
    const stale = await context.request.patch(endpoint, {
      headers,
      data: {
        rating: 1,
        title: "Stale",
        body: "Do not replace",
        updated_at: before.updated_at,
      },
    });
    expect(stale.status()).toBe(409);
    expect((await latest())!.title).toBe(edited);
    const foreign = await browser.newContext({ baseURL: base });
    await signIn(foreign, "explorer1@paradise.com");
    expect(
      (
        await foreign.request.patch(endpoint, {
          headers,
          data: {
            rating: 1,
            title: "Foreign",
            body: "Denied",
            updated_at: after.updated_at,
          },
        })
      ).status(),
    ).toBe(404);
    await foreign.close();
    await page.reload();
    const updated = page
      .locator(".upd-review")
      .filter({
        has: page.getByRole("heading", { name: edited, exact: true }),
      });
    await updated.locator(".review-options summary").click();
    await updated.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = page.getByRole("dialog", {
      name: "Confirm deletion",
      exact: true,
    });
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(updated).toBeVisible();
    await updated.locator(".review-options summary").click();
    await updated.getByRole("button", { name: "Delete", exact: true }).click();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(updated).toHaveCount(0);
    removed = true;
  } finally {
    test.setTimeout(test.info().timeout + 20000);
    if (!removed) {
      const row = await latest();
      if (row) {
        if (![title, edited].includes(row.title))
          throw Error("Fixture review title mismatch");
        expect((await context.request.delete(endpoint, { headers })).ok()).toBe(
          true,
        );
      }
    }
  }
});
