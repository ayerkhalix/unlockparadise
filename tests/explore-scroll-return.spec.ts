import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { signIn } from "./helpers/demo-session";
import type { Trip, TravelPlace } from "../src/lib/planning";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const headers = { Origin: base };
declare global {
  interface Window {
    __instantPaints: { hidden: boolean; error: number | null }[];
  }
}

test("Explore options returns to a middle beach card after browser Back and Return", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180000);
  await page.addInitScript(() =>
    localStorage.setItem("upd-analytics-consent", "off"),
  );
  await page.addInitScript(() => {
    window.__instantPaints = [];
    const sample = () => {
      try {
        const url = location.pathname + location.search + location.hash;
        let saved = history.state?.updBrowsePosition;
        if (saved?.url !== url)
          saved = JSON.parse(
            sessionStorage.getItem(`upd:browse-position:${url}`) || "null",
          );
        const site = document.querySelector(".upd-site");
        if (
          site &&
          saved?.url === url &&
          saved.y > 500 &&
          window.__instantPaints.length < 1200
        ) {
          const link = [
            ...document.querySelectorAll<HTMLAnchorElement>(
              ".planner-destination-card a.upd-card__link",
            ),
          ].find((a) => new URL(a.href).pathname === saved.href);
          window.__instantPaints.push({
            hidden: getComputedStyle(site).visibility === "hidden",
            error: link
              ? Math.abs(link.getBoundingClientRect().top - saved.top)
              : null,
          });
        }
      } catch {
        /* An incomplete streamed document has no snapshot yet. */
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await signIn(context, "explorerplus2@paradise.com");
  const place: TravelPlace = (
    await (
      await context.request.get(
        `${base}/api/v1/planning-places/?search=Tagkawayan`,
      )
    ).json()
  ).data[0];
  const title = `[TEST] Explore return ${randomUUID().slice(0, 8)}`;
  const made = await context.request.post(`${base}/api/v1/itineraries/`, {
    headers,
    data: {
      title,
      notes: "",
      start_date: null,
      end_date: null,
      day_count: 2,
      area_id: place.areaIds![0],
    },
  });
  expect(made.ok()).toBe(true);
  const trip: Trip = (await made.json()).data;
  try {
    await page.goto(
      `/itineraries/explore/?trip=${trip.id}&day=${trip.itinerary_days[1].id}`,
    );
    await page.getByRole("button", { name: "Beaches", exact: true }).click();
    await expect(
      page.getByLabel("Destination filters").getByRole("combobox"),
    ).toHaveCount(0);
    await expect(
      page.locator(".planner-destination-card").first(),
    ).toBeVisible();
    const source = page.url();
    const sourceDocument = await page.evaluate(() => performance.timeOrigin);
    await page.route("**/api/v1/planning-places/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue().catch(() => {});
    });
    const count = await page.locator(".planner-destination-card").count();
    expect(count).toBeGreaterThan(6);
    const middle = Math.floor(count / 2);
    const href = await page
      .locator(".planner-destination-card a.upd-card__link")
      .nth(middle)
      .getAttribute("href");
    const path = new URL(href!, base).pathname;
    for (const mode of [
      "browser",
      "return",
      "manual-history",
      "cached-page",
      "cold-reload",
    ] as const) {
      const link = page.locator(
        `.planner-destination-card a.upd-card__link[href^="${path}"]`,
      );
      await link.scrollIntoViewIfNeeded();
      if (mode === "manual-history")
        await page.evaluate(() => {
          history.scrollRestoration = "manual";
        });
      await link.locator("h2").click();
      await expect(page).toHaveURL(/\/place\//);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(
        sourceDocument,
      );
      const sourceUrl = new URL(source);
      await expect
        .poll(() => page.evaluate(() => history.state?.updBrowseOrigin))
        .toBe(sourceUrl.pathname + sourceUrl.search + sourceUrl.hash);
      const saved = await page.evaluate(
        (source) =>
          JSON.parse(
            sessionStorage.getItem(
              `upd:browse-position:${new URL(source).pathname + new URL(source).search}`,
            ) || "null",
          ),
        source,
      );
      expect(saved?.y).toBeGreaterThan(500);
      if (mode === "return") {
        // Destination-side edits must still refresh the cached browser's stop count.
        const added = await context.request.patch(
          `${base}/api/v1/itineraries/${trip.id}/`,
          {
            headers,
            data: {
              version: trip.version,
              action: "add",
              payload: {
                place_id: place.id,
                day_id: trip.itinerary_days[1].id,
              },
            },
          },
        );
        expect(added.ok()).toBe(true);
      }
      await page.evaluate(() => {
        window.__instantPaints = [];
      });
      if (mode === "return")
        await page.getByRole("link", { name: "‹ Return", exact: true }).click();
      else if (mode === "cold-reload") await page.goto(source);
      else await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(source);
      if (mode === "return")
        await expect(page.locator(".planner-browser-bar p")).toContainText(
          "1 stop",
        );
      await expect(
        page.getByRole("button", { name: "Beaches", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("combobox", { name: "Itinerary day", exact: true }),
      ).toHaveValue(trip.itinerary_days[1].id);
      await expect(
        page.getByLabel("Destination filters").getByRole("combobox"),
      ).toHaveCount(0);
      await expect(
        page
          .getByLabel("Destination filters")
          .locator(".planner-assets legend"),
      ).toHaveText("Assets");
      await expect
        .poll(async () => {
          const rect = await page
            .locator(
              `.planner-destination-card a.upd-card__link[href^="${path}"]`,
            )
            .boundingBox();
          return rect ? Math.abs(rect.y - saved.top) : 99999;
        })
        .toBeLessThan(12);
      if (mode === "cached-page") {
        // A cached return retains listeners previously cancelled by user scrolling.
        await page.evaluate(() => {
          window.dispatchEvent(new WheelEvent("wheel"));
          window.scrollTo({ top: 0, behavior: "instant" });
          window.dispatchEvent(
            new PageTransitionEvent("pageshow", { persisted: true }),
          );
        });
        await expect
          .poll(async () => {
            const rect = await page
              .locator(
                `.planner-destination-card a.upd-card__link[href^="${path}"]`,
              )
              .boundingBox();
            return rect ? Math.abs(rect.y - saved.top) : 99999;
          })
          .toBeLessThan(12);
      }
      await page.waitForTimeout(600);
      const after = await page
        .locator(`.planner-destination-card a.upd-card__link[href^="${path}"]`)
        .boundingBox();
      expect(Math.abs(after!.y - saved.top)).toBeLessThan(12);
      const paints = await page.evaluate(() => window.__instantPaints);
      expect(
        paints.filter((p) => !p.hidden).length,
        `${mode}: returned page paints`,
      ).toBeGreaterThan(0);
      expect(
        paints.filter((p) => !p.hidden && (p.error === null || p.error > 2)),
      ).toEqual([]);
      if (mode !== "cold-reload")
        expect(paints.filter((p) => p.hidden)).toEqual([]);
      expect(
        await page.locator("html").getAttribute("data-browse-restoring"),
      ).toBeNull();
      await mkdir("artifacts/explore-return", { recursive: true });
      await page.screenshot({
        path: `artifacts/explore-return/${info.project.name}-${mode}.png`,
        animations: "disabled",
      });
    }
  } finally {
    const latest: Trip = (
      await (
        await context.request.get(`${base}/api/v1/itineraries/${trip.id}/`)
      ).json()
    ).data;
    expect(latest.title).toBe(title);
    expect(
      (
        await context.request.delete(`${base}/api/v1/itineraries/${trip.id}/`, {
          headers,
          data: { version: latest.version },
        })
      ).ok(),
    ).toBe(true);
  }
});
