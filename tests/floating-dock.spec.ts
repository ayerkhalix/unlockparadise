import { test, expect, type Page } from "@playwright/test";

async function expectAnchored(page: Page) {
  const dock = page.locator(".p2-floating");
  await expect(dock).toHaveCount(1);
  await expect(dock).toBeVisible();
  await expect
    .poll(() =>
      dock.evaluate((el) => {
        const r = el.getBoundingClientRect(),
          inset = innerWidth <= 800 ? 16 : 24;
        return (
          Math.abs(innerHeight - r.bottom - inset) < 1 &&
          Math.abs(innerWidth - r.right - inset) < 1 &&
          getComputedStyle(el).position === "fixed" &&
          el.parentElement === document.body
        );
      }),
    )
    .toBe(true);
}

test("cart and Bucketlist stay fixed while scrolling and navigating", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of ["/merch/", "/contact/", "/merch/cart/"]) {
    await page.goto(route);
    await expectAnchored(page);
    for (const y of [350, 700, 1200, 99999, 0]) {
      await page.evaluate((value) => scrollTo(0, value), y);
      await expectAnchored(page);
    }
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".upd-site")!.style.transform =
        "translateY(20px)";
    });
    await expectAnchored(page);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".upd-site")!.style.transform = "";
    });
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  expect(
    await page.locator(".p2-floating").evaluate((dock) => {
      const r = dock.getBoundingClientRect();
      return [...document.querySelectorAll("footer a")].every((link) => {
        const b = link.getBoundingClientRect();
        return (
          !b.width ||
          !b.height ||
          b.bottom <= r.top ||
          b.top >= r.bottom ||
          b.right <= r.left ||
          b.left >= r.right
        );
      });
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("dock adapts to phone, tablet, desktop and landscape without overflow", async ({
  page,
}) => {
  await page.goto("/merch/");
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expectAnchored(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = (await page.locator(".p2-floating").boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
});

test("typing and dialogs temporarily hide the dock and restore its corner", async ({
  page,
}) => {
  await page.goto("/contact/");
  await expectAnchored(page);
  if (page.viewportSize()!.width <= 600) {
    await page.locator("main input:not([type=hidden])").first().focus();
    await expect(page.locator(".p2-floating")).toBeHidden();
    await page.locator("main input:not([type=hidden])").first().blur();
    await expectAnchored(page);
  }
  const bucket = page.getByRole("button", { name: /^Open Bucketlist/ });
  await bucket.click();
  await expect(
    page.getByRole("dialog", { name: "My Bucketlist" }),
  ).toBeVisible();
  await expect(bucket).toBeHidden();
  await page
    .getByRole("button", { name: "Close My Bucketlist", exact: true })
    .click();
  await expectAnchored(page);
  await expect(bucket).toBeFocused();
});

test("cart count, product addition and store navigation keep one anchored dock", async ({
  page,
}) => {
  await page.goto("/merch/");
  await expectAnchored(page);
  const card = page
    .locator(".p2-product-card")
    .filter({
      has: page.getByRole("button", {
        name: /^Add to cart:/,
        disabled: false,
      }),
    })
    .first();
  await card.locator("select").selectOption({ index: 1 });
  await card.getByRole("button", { name: /^Add to cart:/ }).click();
  await expect(page.locator(".p2-floating b")).toHaveText("1");
  await expectAnchored(page);
  await page.waitForFunction(() => !document.querySelector(".p2-flight"));
  await expectAnchored(page);
  await page.getByRole("link", { name: /^Open shopping cart/ }).click();
  await expect(page).toHaveURL(/\/merch\/cart\/$/);
  await expectAnchored(page);
  await expect(page.locator(".p2-floating b")).toHaveText("1");
});
