import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("unconfigured backend refuses operations and never reports fake success", async ({
  request,
  page,
}) => {
  test.skip(
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    "Offline behavior only.",
  );
  const result = await request.post("/api/auth/login/", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { email: "synthetic@example.test", password: "Synthetic-test-123" },
  });
  expect(result.status()).toBe(503);
  expect(await result.json()).toHaveProperty("error");
  await page.goto("/login/");
  await page.locator("input[name=email]").fill("synthetic@example.test");
  await page.locator("input[name=password]").fill("Synthetic-test-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("not configured");
});
test("direct admin requests, forged membership and foreign-origin mutations fail", async ({
  request,
}) => {
  const admin = await request.get("/api/admin/places/");
  expect([401, 503]).toContain(admin.status());
  const foreign = await request.post("/api/auth/login/", {
    headers: { Origin: "https://attacker.example.test" },
    data: { email: "synthetic@example.test", password: "Synthetic-test-123" },
  });
  expect(foreign.status()).toBe(403);
  const result = await request.get("/place/bayog-beach/?tier=explorer-plus", {
    headers: { Cookie: "premium=true; role=admin" },
  });
  expect(await result.text()).not.toContain("upd-gallery__photo");
});
test("private copied images and source exports cannot be downloaded", async ({
  request,
}) => {
  const routing = JSON.parse(
    fs.readFileSync("src/lib/generated/media-routing.json", "utf8"),
  );
  for (const route of Object.keys(routing).slice(0, 2)) {
    const response = await request.get(route);
    expect(response.status()).toBe(404);
  }
  for (const route of [
    "/reference/wordpress/u177262977_fo9WP.sql",
    "/src/data/destinations.private.json",
    "/artifacts/backend-private/content-manifest.json",
  ])
    expect((await request.get(route)).status()).toBe(404);
});
test("public branding remains available", async ({ request }) => {
  const response = await request.get(
    "/original/wp-content/uploads/2026/07/upd-favicon-teal.png",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});
