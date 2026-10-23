import { test, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { AxeBuilder } from "@axe-core/playwright";

test("membership purchase links send guests through sign-in to checkout", async ({
  page,
}) => {
  await page.goto("/membership/");
  const purchaseLinks = page.getByRole("link", {
    name: "Get Explorer+",
    exact: true,
  });
  await expect(purchaseLinks).toHaveCount(2);
  for (const link of await purchaseLinks.all())
    await expect(link).toHaveAttribute("href", "/checkout/");
  await purchaseLinks.first().click();
  await expect(page).toHaveURL(/\/login\/\?redirect_to=\/checkout\//);
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("Xendit test checkout uses the real account and exposes secure payment status", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.PAYMENT_PROVIDER !== "xendit" || !process.env.XENDIT_SECRET_KEY,
    "Requires configured Xendit sandbox and its private synthetic account.",
  );
  const f = JSON.parse(
    await readFile("artifacts/staging-private/xendit.json", "utf8"),
  );
  expect(f.project).toBe("iitblbdqztuxdzpaetie");
  const jar = new Map<string, string>();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach((c) => jar.set(c.name, c.value)),
      },
    },
  );
  const signed = await db.auth.signInWithPassword({
    email: f.email,
    password: f.password,
  });
  expect(signed.error).toBeNull();
  try {
    await context.addCookies(
      [...jar].map(([name, value]) => ({
        name,
        value,
        url: "http://127.0.0.1:3000",
        sameSite: "Lax" as const,
      })),
    );
    await page.goto("/membership/");
    const purchaseLinks = page.getByRole("link", {
      name: "Get Explorer+",
      exact: true,
    });
    await expect(purchaseLinks).toHaveCount(2);
    for (const link of await purchaseLinks.all())
      await expect(link).toHaveAttribute("href", "/checkout/");
    await expect(
      page.getByRole("link", { name: "Join free", exact: true }),
    ).toHaveCount(0);
    await purchaseLinks.first().click();
    await expect(page).toHaveURL(/\/checkout\/$/);
    // Old bookmarked purchase links must not make an authenticated member register again.
    await page.goto("/join/?redirect_to=/checkout/");
    await expect(page).toHaveURL(/\/checkout\/$/);
    await expect(
      page.getByRole("heading", { name: "Go Explorer+", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This is a Xendit test checkout. No real payment is collected.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Latest test payment", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue to payment", exact: true }),
    ).toBeEnabled();
    await page.getByRole("radio", { name: /One year/ }).check();
    await expect(page.locator(".p3-checkout-total")).toContainText("₱420");
    await page.getByRole("radio", { name: /One month/ }).check();
    await expect(page.locator(".p3-checkout-total")).toContainText("₱50");
    const pending = page.getByRole("button", {
      name: "Check payment status",
      exact: true,
    });
    if (await pending.count()) {
      await pending.click();
      await expect(
        page.locator(
          'section[aria-label="Latest test payment"] [role="status"]',
        ),
      ).toContainText("still pending");
    } else {
      await expect(
        page.getByRole("link", { name: "View membership", exact: true }),
      ).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await mkdir("artifacts/xendit/after", { recursive: true });
    await page.screenshot({
      path: `artifacts/xendit/after/checkout-${page.viewportSize()!.width}.png`,
      fullPage: true,
    });
    const origin = "http://127.0.0.1:3000";
    const forged = await context.request.post("/api/payments/checkout/", {
      headers: { Origin: origin },
      data: {
        plan: "monthly",
        amount_centavos: 1,
        idempotency_key: randomUUID(),
      },
    });
    expect(forged.status()).toBe(400);
    const foreign = await context.request.post("/api/payments/reconcile/", {
      headers: { Origin: "https://foreign.invalid" },
      data: { transaction_id: randomUUID() },
    });
    expect(foreign.status()).toBe(403);
    const owner = await context.request.post("/api/payments/reconcile/", {
      headers: { Origin: origin },
      data: { transaction_id: randomUUID() },
    });
    expect(owner.status()).toBe(404);
    const invalid = await context.request.post("/api/payments/xendit/", {
      headers: { "x-callback-token": "invalid" },
      data: { event: "payment_session.completed" },
    });
    expect(invalid.status()).toBe(401);
    await page.goto(`/checkout/?payment=return&transaction_id=${randomUUID()}`);
    await expect(
      page.getByText(/We could not find this payment for your account/),
    ).toBeVisible();
    await expect(page.getByText(/Returning to your account in/)).toHaveCount(0);

    const paid = await db
      .from("payment_transactions")
      .select("id")
      .eq("user_id", f.id)
      .eq("provider", "xendit")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(paid.error).toBeNull();
    const returnPath = `/checkout/?payment=return&transaction_id=${paid.data!.id}`;
    await page.goto(returnPath);
    const returnedAt = Date.now();
    await expect(
      page.getByText("Returning to your account in 5 seconds.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/xendit/after/return-countdown-${page.viewportSize()!.width}.png`,
      fullPage: true,
    });
    await expect(page).toHaveURL(/\/account\/$/, { timeout: 10000 });
    expect(Date.now() - returnedAt).toBeGreaterThanOrEqual(4500);

    await page.goto(returnPath);
    await page
      .getByRole("button", { name: "Stay on this page", exact: true })
      .click();
    await expect(page.getByText(/Returning to your account in/)).toHaveCount(0);
    // Wait beyond the requested redirect window to prove the timer was cancelled.
    await page.waitForTimeout(5500);
    await expect(page).toHaveURL(
      new RegExp(
        `/checkout/\\?payment=return&transaction_id=${paid.data!.id}$`,
      ),
    );
  } finally {
    await db.auth.signOut({ scope: "local" });
  }
});
