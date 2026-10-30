import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { mediaContext } from "../scripts/media/context.mjs";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
});

test("public phone pages use compact headings and keep readable native inputs", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  test.skip(
    !/mobile|phone/.test(info.project.name),
    "The desktop type scale is unchanged.",
  );
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [route, titleSize] of [
      ["/login/", 24],
      ["/join/", 24],
      ["/membership/", 24],
      ["/contact/", 24],
      ["/privacy-policy/", 24],
      ["/about/", 28],
      ["/area/puerto-princesa/beaches/", 26],
    ] as const) {
      await page.goto(route);
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
      expect(
        await heading.evaluate((node) =>
          parseFloat(getComputedStyle(node).fontSize),
        ),
      ).toBeLessThanOrEqual(titleSize);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(
            'input:not([type="hidden"]):not([type="checkbox"]),select,textarea',
          )
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => node.getBoundingClientRect().width > 0)
              .every(
                (node) => parseFloat(getComputedStyle(node).fontSize) >= 16,
              ),
          ),
      ).toBe(true);
      expect(
        await page
          .locator('input:not([type="hidden"]):not([type="checkbox"]),select')
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => node.getBoundingClientRect().width > 0)
              .every((node) => node.getBoundingClientRect().height >= 44),
          ),
      ).toBe(true);
      if (route === "/login/" || route === "/join/")
        expect(
          (await page.locator(".p2-auth-card").boundingBox())!.y,
        ).toBeLessThanOrEqual(100);
    }
  }
});

test("public cover previews select sharp stored files without granting private media access", async ({
  request,
}) => {
  test.setTimeout(90000);
  const { db } = await mediaContext();
  try {
    const [candidate] = await db`
      select p.id,m.id as media_id from public.places p
      join public.place_media pm on pm.place_id=p.id and pm.kind='cover'
      join public.media m on m.id=pm.media_id and m.status='ready'
      join public.media_files f on f.media_id=m.id and f.bucket=m.bucket and f.status='ready'
      where p.status='publish' and p.vip_content=true and m.bucket='destination-private'
      and p.listing_types @> array['destination']::text[]
      and f.width>=1920 and f.height>=1440 and pm.focal_x=50 and pm.focal_y=50
      limit 1`;
    expect(candidate).toBeTruthy();
    const low = await request.get(`/api/previews/${candidate.id}/?width=640`);
    const high = await request.get(`/api/previews/${candidate.id}/?width=1920`);
    expect(low.ok()).toBe(true);
    expect(high.ok()).toBe(true);
    expect(high.headers().location).toBeUndefined();
    expect(high.headers()["content-type"]).toBe("image/webp");
    const small = await sharp(await low.body()).metadata();
    const large = await sharp(await high.body()).metadata();
    expect(small.width).toBeLessThanOrEqual(640);
    expect(large.width).toBe(1920);
    expect(large.exif).toBeUndefined();
    expect(large.width).toBeGreaterThan(small.width!);
    expect(high.headers().etag).not.toBe(low.headers().etag);
    const cached = await request.get(
      `/api/previews/${candidate.id}/?width=1920`,
      { headers: { "If-None-Match": high.headers().etag } },
    );
    expect(cached.status()).toBe(304);
    expect(
      (await request.get(`/api/previews/${candidate.id}/?width=9999`)).status(),
    ).toBe(400);
    expect(
      (
        await request.get(`/api/media/${candidate.media_id}/?width=1920`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
  } finally {
    await db.end();
  }
});
