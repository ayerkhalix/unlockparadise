import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { temporaryTraveler } from "./helpers/traveler-fixture";
import type { Trip } from "../src/lib/planning";
import { interests, classifyTraveler, archetypes } from "../src/lib/traveler";
const base = "http://127.0.0.1:3000";

test("six traveler titles keep their lettering, contrast and motion preferences", async ({
  page,
  context,
}) => {
  test.setTimeout(150000);
  const traveler = await temporaryTraveler(context);
  try {
    let version = (
      await (await context.request.get("/api/v1/traveler/")).json()
    ).data.version;
    await mkdir("artifacts/traveler-badges/profile", { recursive: true });
    for (const interest of interests) {
      const response = await context.request.put("/api/v1/traveler/", {
        headers: { Origin: base },
        data: {
          op: "complete",
          version,
          answers: {
            interests: [interest.key],
            pace: null,
            style: null,
            companion: null,
            public_badges: false,
          },
        },
      });
      expect(response.ok()).toBe(true);
      version = (await response.json()).data.version;
      await page.goto("/account/");
      const nameplate = page.locator(`.traveler-nameplate--${interest.key}`);
      await expect(nameplate).toHaveText(
        archetypes[classifyTraveler({ interests: [interest.key] })].label,
      );
      await expect(nameplate).toHaveAttribute("data-playing", "true");
      expect(
        await nameplate.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("nameplate-idle");
      await expect(
        page.locator(".td-identity__heading > .upd-icon"),
      ).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await nameplate.evaluate((el) => {
          const style = getComputedStyle(el);
          const family = style.fontFamily.split(",")[0];
          return document.fonts.check(
            `${style.fontWeight} ${style.fontSize} ${family}`,
          );
        }),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const box = await nameplate.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      expect(
        (await new AxeBuilder({ page }).include("#upd-main").analyze())
          .violations,
      ).toEqual([]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(nameplate).toHaveAttribute("data-playing", "false");
      expect(
        await nameplate.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      expect(
        await nameplate
          .locator(".traveler-nameplate__text")
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      await page.locator(".upd-profile__id").screenshot({
        path: `artifacts/traveler-badges/profile/${interest.key}-${page.viewportSize()!.width}.png`,
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    const nameplate = page.locator(".traveler-nameplate");
    await expect(nameplate).toHaveAttribute("data-playing", "true");
    const lettering = nameplate.locator(".traveler-nameplate__text");
    const before = await lettering.evaluate(
      (el) => el.getAnimations()[0].currentTime as number,
    );
    await expect
      .poll(() =>
        lettering.evaluate((el) => el.getAnimations()[0].currentTime as number),
      )
      .toBeGreaterThan(before);
    await page.locator("#account-settings").scrollIntoViewIfNeeded();
    await expect(nameplate).toHaveAttribute("data-playing", "false");
    expect(
      await nameplate.evaluate((el) => getComputedStyle(el).animationPlayState),
    ).toBe("paused");
    await nameplate.scrollIntoViewIfNeeded();
    await expect(nameplate).toHaveAttribute("data-playing", "true");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(nameplate).toHaveAttribute("data-playing", "false");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(nameplate).toHaveAttribute("data-playing", "true");
  } finally {
    await traveler.cleanup();
  }
});
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await mkdir("artifacts/member-identity-map/after", { recursive: true });
  await page.screenshot({
    path: `artifacts/member-identity-map/after/${name}-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
}
test("profile identity, overlapping tier and settings privacy persist", async ({
  page,
  context,
}) => {
  const traveler = await temporaryTraveler(context);
  try {
    const prior = await context.request.get("/api/v1/traveler/");
    const prefs = (await prior.json()).data;
    const saved = await context.request.put("/api/v1/traveler/", {
      headers: { Origin: base },
      data: {
        op: "complete",
        version: prefs.version,
        answers: {
          interests: ["river", "mountain", "coffee"],
          pace: "balanced",
          style: "everything",
          companion: "friends",
          public_badges: false,
        },
      },
    });
    expect(saved.ok()).toBe(true);
    await page.goto("/account/");
    await expect(page.locator(".profile-identity-block")).toContainText(
      "Peaks & Brews Explorer",
    );
    await expect(page.locator(".traveler-likes")).toContainText(
      "Likes: Rivers & Waterfalls, Mountain Hikes, Coffee",
    );
    await expect(page.locator(".td-identity__heading > .upd-icon")).toHaveCount(
      0,
    );
    const mapLink = page.locator(".p3-profile-plan");
    await expect(mapLink).toHaveText("View map");
    await expect(mapLink).toHaveAttribute("href", "/#palawan-map");
    if (page.viewportSize()!.width > 760) {
      const header = await page.locator(".upd-profile__id").boundingBox();
      const button = await mapLink.boundingBox();
      expect(
        Math.abs(header!.x + header!.width - button!.x - button!.width),
      ).toBeLessThanOrEqual(2);
    }
    await expect(page.locator(".membership-label--plus")).toHaveText(
      "Explorer+",
    );
    const avatar = await page.locator(".upd-profile__avatarbtn").boundingBox();
    const label = await page.locator(".membership-label").boundingBox();
    expect(label!.y).toBeLessThan(avatar!.y + avatar!.height);
    expect(label!.y + label!.height).toBeGreaterThan(
      avatar!.y + avatar!.height,
    );
    await expect(
      page.locator(".profile-identity-block input[type=checkbox]"),
    ).toHaveCount(0);
    await capture(page, "profile");
    const privacy = page
      .locator("#account-settings details")
      .filter({ hasText: "Traveler identity visibility" });
    await privacy.locator("summary").click();
    await privacy.getByRole("checkbox").check();
    await expect(privacy).toContainText("Your badges appear on approved");
    await page.reload();
    await privacy.locator("summary").click();
    await expect(privacy.getByRole("checkbox")).toBeChecked();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".traveler-nameplate__text")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await mapLink.click();
    await expect(page).toHaveURL(`${base}/#palawan-map`);
    await expect(page.locator("#palawan-map")).toBeVisible();
  } finally {
    await traveler.cleanup();
  }
});
test("free member gates, private destination identities and savings", async ({
  page,
  context,
}) => {
  const traveler = await temporaryTraveler(context, false);
  try {
    await page.goto("/account/");
    await expect(page.locator(".membership-label--explorer")).toHaveText(
      "Explorer",
    );
    await capture(page, "explorer-profile");
    for (const [path, title] of [
      ["/bucketlist/", "Bucketlist"],
      ["/portfolio/", "Portfolio"],
      ["/itineraries/", "Itinerary Planner"],
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".member-lock")).toContainText(
        "Upgrade to Explorer+ to access this feature.",
      );
    }
    await capture(page, "feature-lock");
    expect((await context.request.get("/api/v1/itineraries/")).status()).toBe(
      403,
    );
    expect(
      (await context.request.get("/api/v1/planning-places/")).status(),
    ).toBe(403);
    const target = await traveler.service
      .from("places")
      .select("id,title,slug")
      .eq("status", "publish")
      .eq("vip_content", true)
      .limit(1)
      .single();
    expect(target.error).toBeNull();
    const place = target.data!;
    const direct = await traveler.db
      .from("places")
      .select("title,slug")
      .eq("id", place.id);
    expect(direct.data).toEqual([]);
    const gate = await context.request.get(`/api/v1/places/${place.id}/`);
    expect(gate.status()).toBe(403);
    expect(await gate.text()).not.toContain(place.slug);
    await page.goto(`/place/${place.id}/`);
    await expect(
      page.getByRole("heading", { name: "Explorer+ destination", exact: true }),
    ).toBeVisible();
    expect(await page.content()).not.toContain(place.title);
    expect(await page.content()).not.toContain(place.slug);
    await capture(page, "destination-lock");
    const search = await context.request.get(
      `/api/v1/places/?search=${encodeURIComponent(place.title)}`,
    );
    expect(
      (await search.json()).data.some((p: { id: string }) => p.id === place.id),
    ).toBe(false);
    await context.clearCookies();
    await page.goto(`/place/${place.id}/`);
    expect(await page.content()).not.toContain(place.title);
    expect(await page.content()).not.toContain(place.slug);
    const login = await context.request.post("/api/auth/login/", {
      headers: { Origin: base },
      data: {
        email: traveler.email,
        password: traveler.password,
        redirect_to: "/checkout/",
      },
    });
    expect(login.ok()).toBe(true);
    await page.goto("/checkout/");
    await expect(page.locator(".p3-membership-plans")).toContainText(
      "Save ₱15 · 10%",
    );
    await expect(page.locator(".p3-membership-plans")).toContainText(
      "Save ₱180 · 30%",
    );
    await page.getByRole("radio").last().check();
    await expect(page.locator(".p3-checkout-total")).toContainText(
      "You save ₱180",
    );
    await capture(page, "checkout-savings");
  } finally {
    await traveler.cleanup();
  }
});
test("planner category browsing and destination preview stay inside the map", async ({
  page,
  context,
}) => {
  const traveler = await temporaryTraveler(context);
  let trip: Trip | undefined;
  try {
    const made = await context.request.post("/api/v1/itineraries/", {
      headers: { Origin: base },
      data: {
        title: "[TEST] In-map discovery",
        notes: "",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        day_count: 2,
      },
    });
    expect(made.ok()).toBe(true);
    trip = (await made.json()).data;
    await page.goto(`/itineraries/?trip=${trip!.id}`);
    if (page.viewportSize()!.width < 760)
      await page
        .getByRole("group", { name: "Planner view" })
        .getByRole("button", { name: "Map", exact: true })
        .click();
    else
      await expect(
        page.locator("#find-destinations .p2-mobile-only"),
      ).toBeHidden();
    const map = page.getByRole("complementary", { name: "Selected day map" });
    await expect(
      map.getByRole("button", { name: "Explore destinations", exact: true }),
    ).toHaveCSS("background-color", "rgb(131, 217, 198)");
    await map
      .getByRole("group", { name: "Choose an area" })
      .getByRole("button")
      .first()
      .click();
    await capture(page, "planner-categories");
    await map.locator(".category-buttons button").first().click();
    const browser = map.getByRole("region", { name: "Destination map" });
    await expect(browser).toBeVisible();
    await expect(
      map.locator(".p2-map-browser .p2-map-list button").first(),
    ).toBeVisible();
    const canvas = await map.locator(".p2-map-canvas").boundingBox();
    const choices = await map.locator(".p2-map-browser").boundingBox();
    expect(choices!.y).toBeGreaterThanOrEqual(canvas!.y);
    expect(choices!.y + choices!.height).toBeLessThanOrEqual(
      canvas!.y + canvas!.height,
    );
    await capture(page, "planner-category-destinations");
    await map.locator(".p2-map-list button").first().click();
    await expect(map.locator(".p2-map-preview")).toBeVisible();
    await capture(page, "planner-destination-preview");
    await map.getByRole("button", { name: /^Add to Day/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Start time", { exact: true }).fill("08:00");
    await dialog.getByLabel("End time", { exact: true }).fill("10:00");
    await dialog
      .getByRole("button", { name: "Add Place", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      map.getByRole("button", { name: "Added to this day", exact: true }),
    ).toBeDisabled();
    await map.getByRole("button", { name: /My route/ }).click();
    await expect(map.getByRole("button", { name: /My route/ })).toHaveCSS(
      "background-color",
      "rgb(131, 217, 198)",
    );
    await expect(
      map.getByRole("button", { name: "View all stops", exact: true }),
    ).toHaveCount(0);
    await capture(page, "planner-route");
    const latest = await context.request.get(
      `/api/v1/itineraries/${trip!.id}/`,
    );
    const saved = (await latest.json()).data;
    expect(saved.items[0].start_time).toBe("08:00:00");
  } finally {
    if (trip) {
      const r = await context.request.get(`/api/v1/itineraries/${trip.id}/`);
      if (r.ok()) {
        const latest = (await r.json()).data;
        await context.request.delete(`/api/v1/itineraries/${trip.id}/`, {
          headers: { Origin: base },
          data: { version: latest.version },
        });
      }
    }
    await traveler.cleanup();
  }
});
