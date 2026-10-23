// Real-service acceptance only. No mocks, production identities or email sends.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { totp } from "./totp.mjs";
import { assertStagingFixture } from "../../scripts/staging-project.mjs";
const report = {
  project: process.env.MIGRATION_PROJECT_REF,
  passed: [],
  failed: [],
  blocked: [],
  email_delivery: "BLOCKED",
  payment_provider: "BLOCKED",
};
const directory = "artifacts/staging-private";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const base = process.env.APP_URL || "http://127.0.0.1:3000";
await mkdir(directory, { recursive: true });
const write = () =>
  writeFile(
    "artifacts/staging-acceptance.json",
    JSON.stringify(report, null, 2),
  );
if (!process.env.SUPABASE_SECRET_KEY) {
  report.blocked.push(
    "SUPABASE_SECRET_KEY is missing; synthetic Auth setup and authenticated acceptance cannot run.",
  );
  await write();
  console.log(
    "BLOCKED: configure the server-only development key locally, then run staging:fixtures and test:staging:authenticated.",
  );
  process.exit(2);
}
assert.equal(process.env.UPD_ENVIRONMENT, "staging");
assert.equal(new URL(url).hostname, `${report.project}.supabase.co`);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "This acceptance runner targets the local application connected to development Supabase.",
);
const fixture = JSON.parse(
  await readFile(`${directory}/identities.json`, "utf8"),
);
assertStagingFixture(fixture);
const trusted = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const clients = {},
  tokens = {};
const ok = (result) => {
  assert.equal(
    result.error,
    null,
    `Supabase error ${result.error?.code || result.error?.status || ""}`,
  );
  return result.data;
};
const checked = async (name, action) => {
  try {
    await action();
    report.passed.push(name);
    console.log(`PASSED: ${name}`);
  } catch {
    report.failed.push(name);
    console.error(`FAILED: ${name}`);
    throw new Error(`Staging acceptance failed: ${name}`);
  } finally {
    await write();
  }
};
const api = async (role, route, method = "GET", body) => {
  const headers = {
    Origin: new URL(base).origin,
    ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}),
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return fetch(base + route, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
};
const json = async (response) => {
  assert.ok(response.ok, `Application HTTP ${response.status}`);
  return response.json();
};
let testPlace, uploaded, privateUploaded, review;
try {
  for (const name of ["explorer", "premium", "expired", "admin"]) {
    const user = fixture.users[name];
    assert.ok(user.email.endsWith("@unlock-paradise.invalid"));
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = ok(
      await db.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      }),
    );
    assert.equal(auth.user.id, user.id);
    clients[name] = db;
    tokens[name] = auth.session.access_token;
  }
  await checked("real sign-in and server-owned access matrix", async () => {
    for (const name of ["explorer", "premium", "expired", "admin"]) {
      const access = ok(await clients[name].rpc("viewer_access"));
      assert.equal(access.premium, name === "premium");
      assert.equal(access.admin, false, "Administrator must complete MFA");
    }
    ok(
      await clients.explorer.auth.updateUser({
        data: { role: "admin", premium: true },
      }),
    );
    assert.equal(
      ok(await clients.explorer.rpc("viewer_access")).premium,
      false,
    );
    assert.ok(
      (
        await clients.explorer
          .from("user_roles")
          .upsert({ user_id: fixture.users.explorer.id, role: "admin" })
      ).error,
    );
    assert.equal((await api("explorer", "/api/admin/places/")).status, 403);
  });
  await checked("real TOTP MFA and trusted administrator access", async () => {
    const db = clients.admin,
      user = fixture.users.admin;
    if (!user.factor) {
      const factor = ok(
        await db.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Synthetic staging acceptance",
        }),
      );
      user.factor = { id: factor.id, secret: factor.totp.secret };
      await writeFile(
        `${directory}/identities.json`,
        JSON.stringify(fixture, null, 2),
        { mode: 0o600 },
      );
    }
    const verified = ok(
      await db.auth.mfa.challengeAndVerify({
        factorId: user.factor.id,
        code: totp(user.factor.secret),
      }),
    );
    tokens.admin = verified.access_token;
    assert.equal(ok(await db.rpc("viewer_access")).admin, true);
    assert.equal((await api("admin", "/api/admin/metrics/")).status, 200);
  });
  const source = JSON.parse(
    await readFile("artifacts/backend-private/content-manifest.json", "utf8"),
  );
  const ordinary = source.places.find((p) => !p.vip_content),
    premium = source.places.find((p) => p.vip_content);
  await checked(
    "authenticated detail RLS, expired membership and private media denial",
    async () => {
      for (const name of ["explorer", "expired"]) {
        assert.equal(
          ok(
            await clients[name]
              .from("place_details")
              .select("place_id")
              .eq("place_id", ordinary.id),
          ).length,
          1,
        );
        assert.equal(
          ok(
            await clients[name]
              .from("place_details")
              .select("place_id")
              .eq("place_id", premium.id),
          ).length,
          0,
        );
        assert.equal(
          (await api(name, `/api/v1/places/${premium.slug}/`)).status,
          403,
        );
      }
      assert.equal(
        ok(
          await clients.premium
            .from("place_details")
            .select("place_id")
            .eq("place_id", premium.id),
        ).length,
        1,
      );
      const privateLink = source.place_media.find(
        (l) =>
          l.place_id === premium.id &&
          source.media.some(
            (m) => m.id === l.media_id && m.bucket === "destination-private",
          ),
      );
      if (privateLink) {
        assert.equal(
          (await api("explorer", `/api/media/${privateLink.media_id}/`)).status,
          404,
        );
        assert.equal(
          (await api("premium", `/api/media/${privateLink.media_id}/`)).status,
          200,
        );
      }
    },
  );
  await checked(
    "persistent bucketlist/visited transitions, duplicates and ownership",
    async () => {
      for (const op of ["save", "save"])
        await json(
          await api("premium", "/api/v1/bucketlist/", "POST", {
            place_id: ordinary.id,
            op,
          }),
        );
      assert.equal(
        ok(
          await clients.premium
            .from("member_places")
            .select("*")
            .eq("place_id", ordinary.id),
        ).length,
        1,
      );
      assert.equal(
        ok(
          await clients.explorer
            .from("member_places")
            .select("*")
            .eq("user_id", fixture.users.premium.id),
        ).length,
        0,
      );
      await json(
        await api("premium", "/api/v1/portfolio/", "POST", {
          place_id: ordinary.id,
          op: "visit",
        }),
      );
      const state = ok(
        await clients.premium
          .from("member_places")
          .select("saved_at,visited_at")
          .eq("place_id", ordinary.id)
          .single(),
      );
      assert.equal(state.saved_at, null);
      assert.ok(state.visited_at);
      await json(
        await api("premium", "/api/v1/me/", "PATCH", {
          display_name: "Staging Premium",
          featured_place_id: ordinary.id,
        }),
      );
      assert.equal(
        (
          await api("expired", "/api/v1/bucketlist/", "POST", {
            place_id: ordinary.id,
            op: "save",
          })
        ).status,
        403,
      );
      const refreshed = ok(await clients.premium.auth.refreshSession());
      tokens.premium = refreshed.session.access_token;
      assert.equal(
        ok(
          await clients.premium
            .from("member_places")
            .select("*")
            .eq("place_id", ordinary.id),
        ).length,
        1,
      );
      assert.equal(
        ok(await clients.premium.auth.getUser()).user.id,
        fixture.users.premium.id,
      );
    },
  );
  const body = {
    title: "[TEST] Staging acceptance",
    slug: "synthetic-staging-" + crypto.randomUUID(),
    status: "publish",
    vip_content: false,
    premium_content: true,
    listing_types: ["destination"],
    travel_minutes: 12,
    accessibility: ["Car"],
    assets: ["Food"],
    featured: false,
    feature_order: 0,
    description: "Synthetic description for hosted acceptance.",
    content: "",
    excerpt: "",
    latitude: 9.8,
    longitude: 118.7,
    weekday_crowd: "Uncrowded",
    weekend_crowd: "Crowded",
    area_ids: [source.areas[0].id],
    category_ids: [source.categories[0].id],
    gallery: [],
    cover_id: null,
  };
  await checked(
    "admin creates a real Place and validates a small Storage image",
    async () => {
      testPlace = (
        await json(await api("admin", "/api/admin/places/", "POST", body))
      ).id;
      const image = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "#168776" },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.set(
        "file",
        new File([image], "synthetic.png", { type: "image/png" }),
      );
      form.set("visibility", "public");
      uploaded = (
        await json(await api("admin", "/api/admin/upload/", "POST", form))
      ).data.id;
      const media = ok(
        await clients.admin
          .from("media")
          .select("bucket,object_path")
          .eq("id", uploaded)
          .single(),
      );
      const object = ok(
        await clients.admin.storage
          .from(media.bucket)
          .download(media.object_path),
      );
      assert.ok(object.size > 0);
      const privateForm = new FormData();
      privateForm.set(
        "file",
        new File([image], "synthetic-private.png", { type: "image/png" }),
      );
      privateForm.set("visibility", "private");
      privateUploaded = (
        await json(
          await api("admin", "/api/admin/upload/", "POST", privateForm),
        )
      ).data.id;
      body.cover_id = uploaded;
      body.gallery = [privateUploaded];
      body.title += " edited";
      await json(
        await api("admin", `/api/admin/places/${testPlace}/`, "PATCH", body),
      );
      assert.equal(
        (await api("explorer", `/api/v1/places/${body.slug}/`)).status,
        200,
      );
      body.vip_content = true;
      await json(
        await api("admin", `/api/admin/places/${testPlace}/`, "PATCH", body),
      );
      assert.equal(
        (await api("explorer", `/api/v1/places/${body.slug}/`)).status,
        403,
      );
      assert.equal(
        (await api("premium", `/api/v1/places/${body.slug}/`)).status,
        200,
      );
      const privateMedia = ok(
        await clients.admin
          .from("media")
          .select("bucket,object_path")
          .eq("id", privateUploaded)
          .single(),
      );
      assert.ok(
        (
          await createClient(url, key)
            .storage.from(privateMedia.bucket)
            .download(privateMedia.object_path)
        ).error,
      );
      assert.ok(
        ok(
          await clients.premium.storage
            .from(privateMedia.bucket)
            .download(privateMedia.object_path),
        ).size > 0,
      );
      assert.equal(
        (await api("explorer", `/api/media/${privateUploaded}/`)).status,
        404,
      );
      const invalid = new FormData();
      invalid.set(
        "file",
        new File(["not an image"], "invalid.png", { type: "image/png" }),
      );
      assert.ok(
        [400, 415].includes(
          (await api("admin", "/api/admin/upload/", "POST", invalid)).status,
        ),
      );
    },
  );
  await checked("real review ownership, likes and moderation", async () => {
    review = (
      await json(
        await api("premium", "/api/v1/reviews/", "POST", {
          place_id: testPlace,
          rating: 5,
          title: "Synthetic review",
          body: "Synthetic staging test.",
        }),
      )
    ).data.id;
    assert.equal(
      (await api("explorer", `/api/v1/reviews/${review}/`, "DELETE")).status,
      404,
    );
    await json(
      await api("admin", `/api/admin/reviews/${review}/`, "PATCH", {
        status: "pending",
      }),
    );
    assert.equal(
      ok(await clients.explorer.from("reviews").select("id").eq("id", review))
        .length,
      0,
    );
    await json(
      await api("admin", `/api/admin/reviews/${review}/`, "PATCH", {
        status: "approved",
      }),
    );
    await json(
      await api("premium", "/api/v1/review-likes/", "POST", {
        review_id: review,
        liked: true,
      }),
    );
    assert.equal(
      Number(
        ok(
          await clients.premium.rpc("review_like_counts", {
            review_ids: [review],
          }),
        )[0].likes,
      ),
      1,
    );
    await json(await api("premium", `/api/v1/reviews/${review}/`, "DELETE"));
    review = null;
  });
  await checked(
    "browser sessions for Explorer, Explorer+, expired member and MFA admin",
    async () => {
      const browser = await chromium.launch({
        channel: process.platform === "win32" ? "chrome" : undefined,
      });
      try {
        for (const name of ["explorer", "premium", "expired", "admin"]) {
          const context = await browser.newContext({
              viewport: { width: 1440, height: 900 },
            }),
            page = await context.newPage();
          await page.goto(base + "/login/");
          await page
            .locator('input[name="email"]')
            .fill(fixture.users[name].email);
          await page
            .locator('input[name="password"]')
            .fill(fixture.users[name].password);
          await page
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
          await page.waitForURL("**/account/", { timeout: 30000 });
          await page.reload();
          assert.ok(
            (await page.locator(".upd-profile__name").textContent()).includes(
              "Staging",
            ),
          );
          await page.goto(base + `/place/${premium.slug}/`);
          if (name === "premium") {
            await page.locator(".place-single").waitFor();
            await page.goto(base + "/bucketlist/");
            await page.goto(base + "/portfolio/");
          }
          if (["explorer", "expired"].includes(name))
            await page.locator(".upd-upgrade").waitFor();
          if (name === "admin") {
            const factor = fixture.users.admin.factor;
            const verified = await page.request.post(base + "/api/auth/mfa/", {
              headers: { Origin: new URL(base).origin },
              data: {
                op: "verify",
                factor_id: factor.id,
                code: totp(factor.secret),
              },
            });
            assert.ok(verified.ok());
            await page.goto(base + "/admin/");
            await page
              .getByRole("heading", {
                name: "Overview",
                exact: true,
              })
              .waitFor();
          }
          await page.screenshot({
            path: `${directory}/${name}.png`,
            fullPage: true,
          });
          await context.close();
        }
      } finally {
        await browser.close();
      }
    },
  );
  await checked(
    "entitlement revocation takes effect on the next real request",
    async () => {
      const id = fixture.users.premium.entitlement_id;
      ok(
        await trusted
          .from("entitlements")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", id),
      );
      try {
        assert.equal(
          (await api("premium", `/api/v1/places/${premium.slug}/`)).status,
          403,
        );
      } finally {
        ok(
          await trusted
            .from("entitlements")
            .update({ revoked_at: null })
            .eq("id", id),
        );
      }
    },
  );
  await checked(
    "real sign-out invalidates refresh and clears the synthetic session",
    async () => {
      ok(await clients.explorer.auth.signOut());
      assert.ok((await clients.explorer.auth.refreshSession()).error);
    },
  );
} catch {
  process.exitCode = 1;
} finally {
  if (review) await api("premium", `/api/v1/reviews/${review}/`, "DELETE");
  if (testPlace) {
    const record = await clients.admin
      .from("places")
      .select("slug")
      .eq("id", testPlace)
      .maybeSingle();
    if (record.data?.slug.startsWith("synthetic-staging-")) {
      await clients.admin
        .from("places")
        .update({ status: "archived" })
        .eq("id", testPlace);
      ok(
        await clients.admin.rpc("admin_delete_place", {
          pid: testPlace,
          confirm_slug: record.data.slug,
        }),
      );
    }
  }
  if (privateUploaded)
    await api("admin", `/api/admin/media/${privateUploaded}/`, "DELETE", {
      confirm_id: privateUploaded,
    });
  if (uploaded)
    await api("admin", `/api/admin/media/${uploaded}/`, "DELETE", {
      confirm_id: uploaded,
    });
  await write();
  console.log(
    JSON.stringify({
      passed: report.passed.length,
      failed: report.failed,
      blocked: report.blocked,
      report: "artifacts/staging-acceptance.json",
    }),
  );
}
