import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { AxeBuilder } from "@axe-core/playwright";
import { stagingIdentity } from "./helpers/staging-auth";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
async function ready(page: Page) {
  await expect
    .poll(async () => page.locator(".studio-load").allTextContents())
    .not.toContain("Loading records…");
  await expect(page.locator(".studio")).toBeVisible();
}
test.describe("Phase 3 real staging Admin Studio", () => {
  let owner: BrowserContext,
    editor: BrowserContext,
    manager: BrowserContext,
    explorer: BrowserContext,
    premium: BrowserContext,
    aal1: BrowserContext;
  const products: number[] = [],
    mediaIds: string[] = [],
    places: string[] = [],
    orders: string[] = [],
    eventSessions: string[] = [];
  const secret = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let fixtureProduct: number,
    variant: string,
    fixturePlace: string,
    fixtureReview: string,
    editorId: string,
    order: string,
    ownerId: string,
    prefix: string;
  const body = (slug: string) => ({
    title: slug,
    slug,
    status: "draft",
    vip_content: false,
    premium_content: false,
    listing_types: ["destination"],
    travel_minutes: null,
    accessibility: [],
    assets: [],
    featured: false,
    feature_order: 0,
    description: "Synthetic studio acceptance only",
    content: "",
    excerpt: "",
    latitude: null,
    longitude: null,
    weekday_crowd: "",
    weekend_crowd: "",
    area_ids: [],
    category_ids: [],
    gallery: [],
    cover_id: null,
  });
  const product = (slug: string) => ({
    name: slug,
    slug,
    sku: slug,
    description: "Synthetic studio acceptance only",
    category: "Studio test",
    price_centavos: 12345,
    compare_at_centavos: null,
    status: "publish",
    featured: false,
    images: [
      { src: "/merch/images/cap-display.png", alt: "Synthetic test cap" },
    ],
    content: { color: "Navy", shortDescription: "Synthetic studio test" },
    variants: [
      {
        sku: slug + "-os",
        label: "One Size",
        price_centavos: 12345,
        stock: 10,
        active: true,
      },
    ],
  });
  async function api(
    context: BrowserContext,
    path: string,
    method = "GET",
    body?: unknown,
  ) {
    const [resource, query] = path.split("?");
    const r = await context.request.fetch(
      base + "/api/admin/" + resource + "/" + (query ? "?" + query : ""),
      { method, headers: { Origin: base }, data: body },
    );
    const value = await r.json();
    if (!r.ok()) throw new Error(`${r.status()} ${path}: ${value.error}`);
    return value;
  }
  test.beforeAll(async ({ browser }, info) => {
    const fixture = JSON.parse(
      await readFile("artifacts/staging-private/identities.json", "utf8"),
    );
    if (
      fixture.project !== "iitblbdqztuxdzpaetie" ||
      process.env.UPD_ENVIRONMENT !== "staging"
    )
      throw new Error("Pinned isolated staging required.");
    prefix = `p3-${info.project.name}-${randomUUID().slice(0, 8)}`;
    for (const role of [
      "admin",
      "editor",
      "order_manager",
      "explorer",
      "premium",
      "aal1",
    ]) {
      const c = await browser.newContext();
      const user = await stagingIdentity(
        c,
        role === "aal1" ? "admin" : role,
        role !== "aal1",
      );
      if (role === "admin") {
        owner = c;
        ownerId = user.id;
      } else if (role === "editor") {
        editor = c;
        editorId = user.id;
      } else if (role === "order_manager") manager = c;
      else if (role === "explorer") explorer = c;
      else if (role === "premium") premium = c;
      else aal1 = c;
    }
    const p = await api(
      owner,
      "merchandise",
      "POST",
      product(prefix + "-fixture"),
    );
    fixtureProduct = p.id;
    products.push(p.id);
    const detail = await api(owner, `merchandise/${p.id}`);
    variant = detail.data[0].merch_variants[0].id;
    const place = await api(owner, "places", "POST", {
      ...body(prefix + "-place"),
      status: "publish",
    });
    fixturePlace = place.id;
    places.push(place.id);
    const review = await explorer.request.post(base + "/api/v1/reviews/", {
      headers: { Origin: base },
      data: {
        place_id: fixturePlace,
        rating: 4,
        title: prefix + " review",
        body: prefix + " synthetic moderation acceptance only",
      },
    });
    if (!review.ok()) throw new Error("Synthetic review creation failed.");
    fixtureReview = (await review.json()).data.id;
    await api(owner, `reviews/${fixtureReview}`, "PATCH", {
      status: "pending",
    });
    const prepared = await secret.rpc("prepare_merch_order", {
      customer: ownerId,
      request_key: randomUUID(),
      lines: [{ variant_id: variant, quantity: 2, unit_centavos: 1 }],
    });
    if (prepared.error) throw new Error(prepared.error.message);
    order = prepared.data;
    orders.push(order);
    const updated = await secret
      .from("merch_orders")
      .update({ provider_session_id: prefix + "-session" })
      .eq("id", order);
    if (updated.error) throw new Error(updated.error.message);
    const confirmed = await secret.rpc("confirm_merch_payment", {
      oid: order,
      event_id: prefix + "-paid",
      payment_id: prefix + "-payment",
      amount: 24690,
      event_hash: "a".repeat(64),
    });
    if (confirmed.error) throw new Error(confirmed.error.message);
    await mkdir("artifacts/phase3", { recursive: true });
  });
  test.afterAll(async () => {
    if (editorId) {
      await secret
        .from("user_roles")
        .upsert({ user_id: editorId, role: "editor" });
      await secret
        .from("entitlements")
        .delete()
        .eq("user_id", editorId)
        .eq("reason", prefix + " membership acceptance");
    }
    if (fixtureReview)
      await secret.from("reviews").delete().eq("id", fixtureReview);
    for (const id of orders) {
      await secret.from("merch_payment_events").delete().eq("order_id", id);
      await secret.from("merch_order_items").delete().eq("order_id", id);
      await secret.from("merch_orders").delete().eq("id", id);
    }
    if (eventSessions.length)
      await secret
        .from("analytics_events")
        .delete()
        .in("session_id", eventSessions);
    for (const id of products) {
      await secret.from("analytics_events").delete().eq("product_id", id);
      await secret.from("merch_variants").delete().eq("product_id", id);
      await secret.from("merch_products").delete().eq("id", id);
    }
    for (const id of mediaIds)
      await api(owner, `media/${id}`, "DELETE", { confirm_id: id });
    for (const id of places) {
      await secret.from("analytics_events").delete().eq("place_id", id);
      await secret.from("places").delete().eq("id", id);
    }
    for (const c of [owner, editor, manager, explorer, premium, aal1])
      await c?.close();
  });
  test.beforeEach(async ({ context }) => {
    await context.addCookies((await owner.storageState()).cookies);
  });
  test("privileged APIs independently enforce real roles and MFA", async ({
    request,
  }) => {
    const inventory = await api(owner, `merchandise/${fixtureProduct}`);
    expect(inventory.data[0].version).toBeGreaterThanOrEqual(2);
    expect(inventory.data[0].merch_variants[0].stock).toBe(8);
    for (const c of [explorer, premium, aal1])
      for (const path of [
        "places",
        "merchandise",
        "orders",
        "analytics",
        "users",
      ]) {
        const r = await c.request.get(base + `/api/admin/${path}/`);
        expect(r.status()).toBe(403);
      }
    expect((await request.get("/api/admin/merchandise/")).status()).toBe(401);
    expect(
      (await editor.request.get(base + "/api/admin/places/")).status(),
    ).toBe(200);
    expect(
      (await editor.request.get(base + "/api/admin/merchandise/")).status(),
    ).toBe(403);
    expect(
      (await manager.request.get(base + "/api/admin/orders/")).status(),
    ).toBe(200);
    expect(
      (await manager.request.get(base + "/api/admin/places/")).status(),
    ).toBe(403);
    const forged = await manager.request.patch(
      base + `/api/admin/orders/${order}/`,
      {
        headers: { Origin: base },
        data: {
          expected_version: 2,
          fulfillment_status: "processing",
          internal_note: "",
          payment_status: "paid",
        },
      },
    );
    expect(forged.status()).toBe(400);
    const csrf = await owner.request.post(base + "/api/admin/merchandise/", {
      headers: { Origin: "https://untrusted.invalid" },
      data: product(prefix + "-csrf"),
    });
    expect(csrf.status()).toBe(403);
  });
  test("owner modules, responsive layouts and accessibility work at five widths", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-1440" ||
        process.env.ADMIN_SKIP_MATRIX === "1",
      "Full width matrix runs once.",
    );
    test.setTimeout(300000);
    const findings: unknown[] = [];
    for (const width of [390, 768, 1024, 1440, 1920])
      for (const section of [
        "overview",
        "places",
        "merchandise",
        "orders",
        "analytics",
        "members",
        "reviews",
        "settings",
      ]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/admin/?section=${section}`);
        await ready(page);
        await expect(page.locator("h1")).toHaveCount(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          `${section} at ${width}`,
        ).toBe(true);
        const axe = await new AxeBuilder({ page }).analyze();
        if (axe.violations.length)
          findings.push({
            width,
            section,
            violations: axe.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
          });
        await page.screenshot({
          path: `artifacts/phase3/${section}-${width}.png`,
          fullPage: true,
        });
      }
    await writeFile(
      "artifacts/phase3/accessibility.json",
      JSON.stringify(findings, null, 2),
    );
    expect(findings).toEqual([]);
  });
  test("studio menu restores focus and lists retain URL filters and history", async ({
    page,
  }, info) => {
    await page.goto("/admin/?section=places");
    await ready(page);
    if (info.project.name === "mobile-390") {
      const menu = page.getByRole("button", { name: "Open studio menu" });
      await menu.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    }
    await page
      .getByLabel("Search Places", { exact: true })
      .fill(prefix + "-place");
    await expect(page).toHaveURL(/search=/);
    await expect(
      page.getByRole("region", { name: "Place library", exact: true }),
    ).toContainText(prefix + "-place");
    await page.getByLabel("Statuses", { exact: true }).selectOption("draft");
    await expect(
      page.getByText("No matching Places. Clear the filters or add a Place."),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("region", { name: "Place library", exact: true }),
    ).toContainText(prefix + "-place");
  });
  test("Place and product editors remain usable at all five widths with native controls and reduced motion", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop-1440",
      "Editor width matrix runs once.",
    );
    test.setTimeout(180000);
    for (const kind of ["places", "merchandise"]) {
      await page.goto(`/admin/?section=${kind}`);
      await ready(page);
      await page
        .getByRole("button", {
          name: kind === "places" ? "Add Place" : "Add product",
          exact: true,
        })
        .click();
      await page
        .locator(".studio-content details")
        .evaluateAll((nodes) =>
          nodes.forEach((node) => ((node as HTMLDetailsElement).open = true)),
        );
      for (const width of [390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          `${kind} editor at ${width}`,
        ).toBe(true);
        if ([390, 1440].includes(width))
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
      }
      if (kind === "merchandise") {
        const chooser = page.getByLabel("Color", { exact: true });
        await chooser.selectOption("Sand");
        await chooser.focus();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(
          page.getByRole("heading", { name: "Add product", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByLabel("Search photos", { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByLabel("Upload product photos", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Back to Merchandise", exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Discard", exact: true })
          .click();
      } else
        await page
          .getByRole("button", { name: "Back to Places", exact: true })
          .click();
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/?section=merchandise");
    await ready(page);
    expect(
      await page
        .getByRole("button", { name: "Add product", exact: true })
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
  });
  test("product create, publish, price update and archive reach the storefront and reconcile a saved bag", async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    const name = prefix + "-ui-product";
    await page.goto("/admin/?section=merchandise");
    await ready(page);
    await page
      .getByRole("button", { name: "Add product", exact: true })
      .click();
    await page.getByLabel("Product name", { exact: true }).fill(name);
    await page.getByText("Advanced", { exact: true }).click();
    await page.getByLabel("Slug", { exact: true }).fill(name);
    await page.getByLabel("Product SKU", { exact: true }).fill(name);
    await page
      .getByLabel("Product price (PHP)", { exact: true })
      .fill("123.45");
    const variants = page.locator(".studio-variant");
    await variants.locator("summary").click();
    await variants.getByLabel("SKU", { exact: true }).fill(name + "-os");
    await variants.getByLabel("Price (PHP)", { exact: true }).fill("123.45");
    await variants.getByLabel("Stock", { exact: true }).fill("5");
    const photo = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "#83d9c6" },
    })
      .png()
      .toBuffer();
    const uploaded = page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/upload/") &&
        r.request().method() === "POST",
    );
    await page
      .getByLabel("Upload product photos", { exact: true })
      .setInputFiles({
        name: "studio-product.png",
        mimeType: "image/png",
        buffer: photo,
      });
    const uploadedResult = await (await uploaded).json();
    mediaIds.push(uploadedResult.data.id);
    await expect(
      page.getByText("1 of 8 photos", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Publish product", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Merchandise", exact: true }),
    ).toBeVisible();
    const saved = await api(
      owner,
      `merchandise?search=${encodeURIComponent(name)}`,
    );
    const created = saved.data.find((p: { slug: string }) => p.slug === name);
    expect(created).toBeTruthy();
    products.push(created.id);
    await page.goto(`/merch/products/${name}/`);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add to bag", exact: true }).click();
    await page.goto("/merch/cart/");
    await expect(page.getByRole("main")).toContainText("123.45");
    const body2 = {
      ...product(name),
      name,
      expected_version: created.version,
      price_centavos: 13000,
      variants: created.merch_variants.map(
        (v: { id: string; sku: string; label: string; stock: number }) => ({
          id: v.id,
          sku: v.sku,
          label: v.label,
          stock: v.stock,
          price_centavos: 13000,
          active: true,
        }),
      ),
    };
    await api(owner, `merchandise/${created.id}`, "PATCH", body2);
    await page.reload();
    await expect(
      page.getByText("The price has changed. The current price is shown."),
    ).toBeVisible();
    await expect(page.getByRole("main")).toContainText("130.00");
    const stale = await owner.request.patch(
      base + `/api/admin/merchandise/${created.id}/`,
      { headers: { Origin: base }, data: body2 },
    );
    expect(stale.status()).toBe(409);
    await api(owner, `merchandise/${created.id}`, "PATCH", {
      ...body2,
      expected_version: created.version + 1,
      status: "archived",
    });
    await page.reload();
    await expect(
      page.getByText(
        "Some saved selections are unavailable or exceed current stock.",
        { exact: false },
      ),
    ).toBeVisible();
    const detail = await context.request.get(`/merch/products/${name}/`);
    expect(detail.status()).toBe(404);
  });
  test("Place editor validates, saves SEO and travel fields, and keeps unsaved work after cancellation", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto(`/admin/?section=places&search=${prefix}-place`);
    await ready(page);
    await page
      .getByRole("button", { name: new RegExp(`Edit ${prefix}-place`) })
      .click();
    await page.getByLabel("Title", { exact: true }).fill(prefix + "-changed");
    await page
      .getByRole("button", { name: "Back to Places", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Discard unsaved Place changes?",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      prefix + "-changed",
    );
    await page.getByText("Travel information", { exact: true }).click();
    await page
      .getByLabel("Verified hike time (minutes)", { exact: true })
      .fill("35");
    await page.getByText("Search / SEO", { exact: true }).click();
    await page
      .getByLabel("Search title", { exact: true })
      .fill("Synthetic SEO title");
    await page.getByRole("button", { name: "Save Place", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Places", exact: true }),
    ).toBeVisible();
    const saved = await api(owner, `places/${fixturePlace}`);
    expect(saved.data[0].place_details.seo.title).toBe("Synthetic SEO title");
    expect(Number(saved.data[0].place_details.hike_minutes)).toBe(35);
  });
  test("Place creation, draft preview, publishing, safe deletion and product duplication work through the interface", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const name = prefix + "-ui-place";
    await page.goto("/admin/?section=places");
    await ready(page);
    await page.getByRole("button", { name: "Add Place", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(name);
    await page.getByLabel("Slug", { exact: true }).fill(name);
    await page
      .getByLabel("Add areas", { exact: true })
      .selectOption({ index: 1 });
    await page
      .getByLabel("Add categories", { exact: true })
      .selectOption({ index: 1 });
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Places", exact: true }),
    ).toBeVisible();
    const created = (await api(owner, `places?search=${name}`)).data.find(
      (p: { slug: string }) => p.slug === name,
    );
    expect(created?.status).toBe("draft");
    places.push(created.id);
    expect((await request.get(`/place/${name}/`)).status()).toBe(404);
    await page.getByLabel("Search Places", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    const popup = page.waitForEvent("popup");
    await page
      .getByRole("link", { name: "Preview saved Place", exact: true })
      .click();
    const preview = await popup;
    await expect(
      preview.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await preview.close();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Places", exact: true }),
    ).toBeVisible();
    expect((await request.get(`/place/${name}/`)).status()).toBe(200);
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    await page.locator('select[name="status"]').selectOption("archived");
    await page.getByRole("button", { name: "Save Place", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Places", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect((await api(owner, `places/${created.id}`)).data[0].status).toBe(
      "archived",
    );
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByLabel("Confirmation", { exact: true }).fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(
      page.getByText("No matching Places. Clear the filters or add a Place."),
    ).toBeVisible();
    expect((await api(owner, `places/${created.id}`)).data).toHaveLength(0);
    await page.goto(`/admin/?section=merchandise&search=${prefix}-fixture`);
    await ready(page);
    const response = page.waitForResponse(
      (r) =>
        r.url().includes(`/merchandise/${fixtureProduct}/duplicate/`) &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    const duplicated = await response;
    expect(duplicated.status()).toBe(201);
    const id = (await duplicated.json()).id;
    products.push(id);
    const copy = (await api(owner, `merchandise/${id}`)).data[0];
    expect(copy.status).toBe("draft");
    expect(copy.merch_variants[0].stock).toBe(0);
    expect(copy.sku).not.toBe(prefix + "-fixture");
  });
  test("uploaded product photos remain public and cannot be revoked or deleted while associated", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const name = prefix + "-fixture";
    await page.goto(`/admin/?section=merchandise&search=${name}`);
    await ready(page);
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#14665f" },
    })
      .png()
      .toBuffer();
    const uploaded = page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/upload/") &&
        r.request().method() === "POST",
    );
    await page
      .getByLabel("Upload product photos", { exact: true })
      .setInputFiles({
        name: "synthetic-product.png",
        mimeType: "image/png",
        buffer: png,
      });
    const response = await uploaded;
    expect(response.status()).toBe(201);
    const id = (await response.json()).data.id;
    mediaIds.push(id);
    await expect(
      page.getByText("2 of 8 photos", { exact: true }),
    ).toBeVisible();
    await page
      .locator(`.product-photo:has(img[src="/api/media/${id}/"])`)
      .getByRole("button", { name: "Make cover", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Merchandise", exact: true }),
    ).toBeVisible();
    const rejected = await owner.request.patch(
      base + `/api/admin/media/${id}/`,
      { headers: { Origin: base }, data: { status: "rejected" } },
    );
    expect(rejected.status()).toBe(409);
    const deletion = await owner.request.delete(
      base + `/api/admin/media/${id}/`,
      { headers: { Origin: base }, data: { confirm_id: id } },
    );
    expect(deletion.status()).toBe(409);
    expect((await owner.request.get(base + `/api/media/${id}/`)).status()).toBe(
      200,
    );
    expect(
      (await secret.from("media").select("status,bucket").eq("id", id).single())
        .data,
    ).toEqual({ status: "ready", bucket: "destination-public" });
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    await page
      .locator(`.product-photo:has(img[src="/api/media/${id}/"])`)
      .getByRole("button", { name: "Remove photo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Merchandise", exact: true }),
    ).toBeVisible();
    await api(owner, `media/${id}`, "DELETE", { confirm_id: id });
    mediaIds.splice(mediaIds.indexOf(id), 1);
  });
  test("order manager updates fulfillment without changing provider payment, and exports safe CSV", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addCookies((await manager.storageState()).cookies);
    await page.goto(`/admin/?section=orders&search=${order}`);
    await ready(page);
    await page
      .getByRole("button", { name: new RegExp("View order " + order) })
      .click();
    await page
      .getByLabel("Fulfillment", { exact: true })
      .selectOption("processing");
    await page
      .getByLabel("Internal order note", { exact: true })
      .fill("Synthetic fulfillment acceptance only");
    await page.getByRole("button", { name: "Save order", exact: true }).click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = await api(manager, `orders/${order}`);
    expect(saved.data[0].fulfillment_status).toBe("processing");
    expect(saved.data[0].payment_status).toBe("paid");
    const csv = await manager.request.get(
      base + `/api/admin/orders/?search=${order}&format=csv`,
    );
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("24690");
  });
  test("member permissions, manual entitlements and review moderation persist with audit history", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const memberUrl = "/admin/?section=members&search=Staging%20editor";
    await page.goto(memberUrl);
    await ready(page);
    await page
      .getByRole("button", { name: "Manage Staging editor", exact: true })
      .click();
    await page.getByText("Studio permissions", { exact: true }).click();
    await page
      .getByLabel("Administrative role", { exact: true })
      .selectOption("order_manager");
    try {
      await page
        .getByRole("button", { name: "Save access", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .last()
        .getByRole("button", { name: "Change", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        (await editor.request.get(base + "/api/admin/places/")).status(),
      ).toBe(403);
    } finally {
      await secret
        .from("user_roles")
        .upsert({ user_id: editorId, role: "editor" });
    }
    await page.goto(memberUrl);
    await ready(page);
    await page
      .getByRole("button", { name: "Manage Staging editor", exact: true })
      .click();
    await page.getByText("Grant Explorer+", { exact: true }).click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill(prefix + " membership acceptance");
    await page
      .getByRole("button", { name: "Grant membership", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Grant", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const entitlement = await secret
      .from("entitlements")
      .select("id,revoked_at")
      .eq("user_id", editorId)
      .eq("reason", prefix + " membership acceptance")
      .single();
    expect(entitlement.error).toBeNull();
    expect(entitlement.data?.revoked_at).toBeNull();
    await page
      .getByRole("button", { name: "Manage Staging editor", exact: true })
      .click();
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Revoke", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (
        await secret
          .from("entitlements")
          .select("revoked_at")
          .eq("id", entitlement.data!.id)
          .single()
      ).data?.revoked_at,
    ).toBeTruthy();
    await page.goto(`/admin/?section=reviews&search=${prefix}`);
    await ready(page);
    await page
      .getByRole("button", { name: "Review by Staging explorer", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Moderation history");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Publish", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await api(owner, `reviews/${fixtureReview}`)).data[0].status).toBe(
      "approved",
    );
    await page
      .getByRole("button", { name: "Review by Staging explorer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hide review", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Hide", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const moderated = await api(owner, `reviews/${fixtureReview}`);
    expect(moderated.data[0].status).toBe("rejected");
    expect(moderated.history.length).toBeGreaterThanOrEqual(3);
  });
  test("analytics ingestion checks consent, entities, deduplication and owner-only aggregation", async () => {
    const session = randomUUID();
    eventSessions.push(session);
    const payload = {
      event_id: randomUUID(),
      session_id: session,
      name: "place_viewed",
      place_id: fixturePlace,
      consent: true,
    };
    const send = (v: unknown) =>
      owner.request.post(base + "/api/v1/interest/", {
        headers: { Origin: base },
        data: v,
      });
    expect((await send({ ...payload, consent: false })).status()).toBe(400);
    expect((await send(payload)).status()).toBe(200);
    expect((await send({ ...payload, event_id: randomUUID() })).status()).toBe(
      200,
    );
    const result = await secret
      .from("analytics_events")
      .select("event_id")
      .eq("session_id", session);
    expect(result.data).toHaveLength(1);
    const bad = await owner.request.get(
      base + "/api/admin/analytics/?from=2026-01-01&to=2026-10-19",
    );
    expect(bad.status()).toBe(400);
  });
  test("failure retry preserves the workspace and optional tracking stays off in automated browsing", async ({
    page,
  }) => {
    await page.route("**/api/admin/merchandise/**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic temporary failure" }),
      }),
    );
    await page.goto("/admin/?section=merchandise");
    await expect(page.locator(".studio-load").getByRole("alert")).toContainText(
      "Synthetic temporary failure",
    );
    await page.unroute("**/api/admin/merchandise/**");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Merchandise catalog", exact: true }),
    ).toContainText(prefix + "-fixture");
    let calls = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/interest/")) calls++;
    });
    await page.goto(`/merch/products/${prefix}-fixture/`);
    await page
      .getByRole("button", { name: "Privacy preferences", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Allow analytics", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: prefix + "-fixture", exact: true }),
    ).toBeVisible();
    expect(calls).toBe(0);
  });
});
