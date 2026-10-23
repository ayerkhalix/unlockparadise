import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const output = "artifacts/phase2/audit";
const widths = [375, 390, 430, 768, 1024, 1440, 1920];
const only = process.env.AUDIT_ROLE;
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "chrome" : undefined,
});
await mkdir(output, { recursive: true });
const results = [];
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(
    (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1e6)
    .toString()
    .padStart(6, "0");
}
async function record(page, role, route, tab) {
  const id = (role + "-" + route + (tab || "")).replace(/[^a-z0-9-]/gi, "_");
  const errors = [];
  const listen = (e) => errors.push(e.message);
  page.on("pageerror", listen);
  let response;
  if (!tab && route !== "/admin/editor") {
    response = await page.goto(base + route);
    await page.waitForFunction(
      () => document.documentElement.dataset.updReady === "true",
    );
  } else if (tab) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForTimeout(650);
  }
  await page.evaluate(() => document.fonts.ready);
  // Hydrate and load lazy photos before screenshots; no mock API or map responses.
  await page.evaluate(() => {
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((i) => (i.loading = "eager"));
  });
  await page.waitForTimeout(600);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
      width: document.documentElement.scrollWidth,
      brokenImages: [...document.images]
        .filter((i) => i.complete && !i.naturalWidth)
        .map((i) => i.getAttribute("src")),
      unnamedButtons: [...document.querySelectorAll("button")]
        .filter(
          (b) =>
            b.getBoundingClientRect().width &&
            !b.getAttribute("aria-label") &&
            !b.getAttribute("aria-labelledby") &&
            !b.textContent.trim() &&
            !b.querySelector("img[alt]"),
        )
        .map((b) => b.outerHTML.slice(0, 220)),
      contactOffset: (() => {
        const e = document.querySelector(
          'form[data-endpoint="/api/v1/contact/"]',
        );
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - innerWidth / 2);
      })(),
    }));
    const violations = [390, 1440].includes(width)
      ? (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }))
      : null;
    await page.screenshot({
      path: `${output}/${id}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    results.push({
      role,
      route,
      tab,
      width,
      status: response?.status() || 200,
      finalPath: new URL(page.url()).pathname,
      ...geometry,
      violations,
      errors: [...errors],
    });
  }
  page.off("pageerror", listen);
  await writeFile(
    `${output}/results-${only || "all"}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    `${role} ${route}${tab ? " " + tab : ""}: ${results.slice(-7).filter((r) => r.overflow || r.unnamedButtons.length || r.violations?.length || r.errors.length).length} flagged viewports`,
  );
}
try {
  for (const role of ["public", "premium", "admin"].filter(
    (r) => !only || r === only,
  )) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      timezoneId: "Asia/Manila",
    });
    let trip;
    if (role !== "public") {
      const user = JSON.parse(
        await readFile("artifacts/staging-private/identities.json", "utf8"),
      ).users[role];
      const login = await context.request.post(base + "/api/auth/login/", {
        headers: { Origin: base },
        data: { email: user.email, password: user.password },
      });
      if (!login.ok()) throw new Error("Audit sign-in failed");
      if (role === "admin") {
        const mfa = await context.request.post(base + "/api/auth/mfa/", {
          headers: { Origin: base },
          data: {
            op: "verify",
            factor_id: user.factor.id,
            code: totp(user.factor.secret),
          },
        });
        if (!mfa.ok()) throw new Error("Audit MFA failed");
      }
      if (role === "premium") {
        const response = await context.request.post(
          base + "/api/v1/itineraries/",
          {
            headers: { Origin: base },
            data: {
              title: "[TEST] Responsive audit",
              notes: "Synthetic audit trip",
              day_count: 3,
              start_date: null,
              end_date: null,
            },
          },
        );
        if (!response.ok()) throw new Error("Audit trip creation failed");
        trip = (await response.json()).data;
        const search = await context.request.get(
          base + "/api/v1/planning-places/?search=mandyukot",
        );
        const place = (await search.json()).data[0];
        if (place) {
          const add = await context.request.patch(
            base + `/api/v1/itineraries/${trip.id}/`,
            {
              headers: { Origin: base },
              data: {
                version: trip.version,
                action: "add",
                payload: {
                  day_id: trip.itinerary_days[0].id,
                  place_id: place.id,
                },
              },
            },
          );
          if (!add.ok()) throw new Error("Audit trip add failed");
          trip = (await add.json()).data;
        }
      }
    }
    const page = await context.newPage();
    try {
      const routes =
        role === "public"
          ? [
              "/",
              "/about/",
              "/membership/",
              "/contact/",
              "/login/",
              "/join/",
              "/forgot-password/",
              "/reset-password/",
              "/privacy-policy/",
              "/terms/",
              "/refunds/",
              "/checkout/",
              "/get-paid/",
              "/area/ppc-north/beaches/",
              "/area/ppc-north/",
              "/area/ppc-south/",
              "/area/puerto-princesa/",
              "/area/el-nido/",
              "/place_category/beaches/",
              "/place_category/rivers/",
              "/place_category/islands/",
              "/place_category/waterfalls/",
              "/place_category/mountain-hikes/",
              "/place_category/others/",
              "/place_category/restaurants/",
              "/place_category/coffee/",
              "/place/bayog-beach/",
              "/merch/",
              "/merch/products/whats-it-gonna-be-tee/",
              "/merch/cart/",
              "/merch/checkout/",
            ]
          : role === "premium"
            ? [
                "/account/",
                "/bucketlist/",
                "/visited/",
                "/portfolio/",
                "/itineraries/",
                "/itineraries/new/",
                `/itineraries/${trip.id}/`,
                "/place/mandyukot-beach/",
                "/place/100-cafe-moto/",
                "/place/magarwak-mountain/",
              ]
            : ["/admin/", "/admin/mfa/"];
      for (const route of routes) await record(page, role, route);
      if (role === "admin") {
        await page.goto(base + "/admin/");
        for (const section of [
          "overview",
          "places",
          "places&view=media",
          "merchandise",
          "orders",
          "analytics",
          "members",
          "reviews",
          "settings",
          "settings&view=activity",
          "settings&view=contacts",
          "settings&view=integrations",
        ])
          await record(page, role, "/admin/?section=" + section);
        await page.goto(base + "/admin/?section=places");
        await page
          .getByRole("button", { name: /^Edit / })
          .first()
          .waitFor();
        const preview = await page
          .getByRole("link", { name: "Preview", exact: true })
          .first()
          .getAttribute("href");
        const previewPage = await context.newPage();
        if (preview) await record(previewPage, role, preview);
        await previewPage.close();
        await page
          .getByRole("button", { name: /^Edit / })
          .first()
          .click();
        await page
          .getByRole("heading", { name: "Edit Place", exact: true })
          .waitFor();
        await record(page, role, "/admin/editor", "");
        await page
          .getByRole("button", { name: "Back to Places", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Add Place", exact: true })
          .click();
        await record(page, role, "/admin/editor", "");
      }
    } finally {
      if (trip)
        await context.request.delete(base + `/api/v1/itineraries/${trip.id}/`, {
          headers: { Origin: base },
          data: { version: trip.version },
        });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  JSON.stringify({
    checks: results.length,
    flagged: results.filter(
      (r) =>
        r.overflow ||
        r.unnamedButtons.length ||
        r.violations?.length ||
        r.errors.length,
    ).length,
  }),
);
