import { test, expect } from "@playwright/test";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { mediaContext } from "../scripts/media/context.mjs";
import { signIn } from "./helpers/demo-session";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };
test.use({ actionTimeout: 20000, navigationTimeout: 45000 });

test("member images use existing objects without Supabase transformations and retain private access", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  const transforms: string[] = [];
  await context.route("**/storage/v1/render/image/**", (route) => {
    transforms.push("transformation");
    return route.abort();
  });
  await signIn(context, "explorerplus2@paradise.com");
  const catalog = await (
    await context.request.get(
      `${base}/api/v1/planning-places/?search=Tagkawayan`,
    )
  ).json();
  const source = catalog.data[0].image.split("#")[0];
  const url = new URL(source, base);
  url.searchParams.set("width", "640");
  const response = await context.request.get(url.href, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/storage/v1/object/");
  expect(response.headers().location).not.toContain("/render/image/");
  const { db, storage } = await mediaContext();
  try {
    const candidates = await storage
      .from("media")
      .select("id")
      .eq("bucket", "destination-private")
      .eq("status", "ready")
      .limit(5);
    for (const candidate of candidates.data || []) {
      const guest = await page.context().browser()!.newContext();
      try {
        const denied = await guest.request.get(
          `${base}/api/media/${candidate.id}/?width=640`,
          { maxRedirects: 0 },
        );
        expect(denied.status()).toBe(404);
      } finally {
        await guest.close();
      }
    }
  } finally {
    await db.end();
  }
  await page.goto("/area/puerto-princesa/beaches/");
  await expect(page.locator("main")).toBeVisible();
  expect(transforms).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("admin direct upload preserves a large original exactly, publishes variants once and supports retry", async ({
  context,
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-1440",
    "One controlled upload exercises server behavior; layout is covered separately.",
  );
  test.setTimeout(180000);
  await signIn(context, "unlockadmin@paradise.com");
  const { db, storage } = await mediaContext();
  const bytes = await sharp(randomBytes(1600 * 1600 * 3), {
    raw: { width: 1600, height: 1600, channels: 3 },
  })
    .jpeg({ quality: 100, chromaSubsampling: "4:4:4" })
    .toBuffer();
  expect(bytes.length).toBeGreaterThan(4.5 * 1024 * 1024);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const alt = `[TEST] Image optimization ${randomUUID()}`;
  let jobId: string | undefined;
  try {
    await page.goto("/admin/?section=settings&view=media");
    const form = page
      .locator("form")
      .filter({
        has: page.getByRole("heading", {
          name: "Upload an image",
          exact: true,
        }),
      });
    await form
      .getByLabel("Image", { exact: true })
      .setInputFiles({
        name: "synthetic-original.jpg",
        mimeType: "image/jpeg",
        buffer: bytes,
      });
    await form.locator('select[name="visibility"]').selectOption("public");
    await form.getByLabel("Alternative text", { exact: true }).fill(alt);
    const pending = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/upload/prepare/") &&
        r.request().method() === "POST",
    );
    await form
      .getByRole("button", { name: "Upload image", exact: true })
      .click();
    const prepared = await pending;
    expect(prepared.ok()).toBe(true);
    const data = (await prepared.json()).data;
    jobId = data.job_id;
    await expect
      .poll(
        async () => {
          const row = await storage
            .from("media_upload_jobs")
            .select("state")
            .eq("id", jobId!)
            .single();
          return row.data?.state;
        },
        { timeout: 120000 },
      )
      .toBe("ready");
    const complete = await storage
      .from("media_upload_jobs")
      .select("media_id")
      .eq("id", jobId)
      .single();
    const mediaId = complete.data!.media_id;
    expect(mediaId).toBeTruthy();
    const original = await storage
      .from("media_files")
      .select("*")
      .eq("media_id", mediaId)
      .eq("variant", "original")
      .single();
    expect(original.data.bucket).toBe("media-archive");
    expect(original.data.checksum).toBe(hash);
    const saved = await storage.storage
      .from("media-archive")
      .download(original.data.object_path);
    expect(
      createHash("sha256")
        .update(Buffer.from(await saved.data!.arrayBuffer()))
        .digest("hex"),
    ).toBe(hash);
    const copies = await storage
      .from("media_files")
      .select("width,height,mime_type")
      .eq("media_id", mediaId)
      .neq("variant", "original");
    expect(copies.data!.length).toBeGreaterThan(3);
    expect(
      copies.data!.every(
        (f) => f.mime_type === "image/webp" && f.width <= 1600,
      ),
    ).toBe(true);
    const retry = await context.request.post(
      `${base}/api/admin/upload/${jobId}/`,
      { headers },
    );
    expect((await retry.json()).data.id).toBe(mediaId);
    const ready = await context.request.get(
      `${base}/api/media/${mediaId}/?width=640`,
      { maxRedirects: 0 },
    );
    expect(ready.headers().location).toContain("/object/public/");
    expect(ready.headers().location).toContain("w640.webp");
    const guest = await context.browser()!.newContext();
    try {
      const denied = await guest.request.post(
        `${base}/api/admin/upload/${jobId}/`,
        { headers },
      );
      expect(denied.status()).toBe(401);
    } finally {
      await guest.close();
    }
  } finally {
    if (jobId) {
      const job = await storage
        .from("media_upload_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      expect(job.data.alt).toBe(alt);
      expect(job.data.source_checksum).toBe(hash);
      const files = await storage
        .from("media_files")
        .select("bucket,object_path")
        .eq("media_id", job.data.media_id);
      for (const file of files.data || []) {
        expect(file.object_path).toContain(jobId);
        await storage.storage.from(file.bucket).remove([file.object_path]);
      }
      await storage.storage
        .from("media-archive")
        .remove([job.data.source_path]);
      await storage
        .from("media")
        .delete()
        .eq("id", job.data.media_id)
        .eq("alt", alt);
      await storage
        .from("media_upload_jobs")
        .delete()
        .eq("id", jobId)
        .eq("alt", alt);
    }
    await db.end();
  }
});
