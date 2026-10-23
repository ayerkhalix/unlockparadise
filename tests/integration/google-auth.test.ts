import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  authOrigin,
  googleAuthorizeUrl,
  googleReturnPath,
  issueGoogleFlow,
  readGoogleFlow,
} from "../../src/lib/auth/google";

test("Google callbacks bind the signed return path to the browser nonce, origin and expiry", () => {
  const previous = process.env.AUTH_RECOVERY_SECRET;
  process.env.AUTH_RECOVERY_SECRET =
    "synthetic-oauth-unit-test-secret-32-characters";
  try {
    const origin = "https://staging.example.invalid",
      now = 1800000000000;
    const { flow, cookie } = issueGoogleFlow(
      "/checkout/?plan=annual",
      origin,
      now,
    );
    assert.equal(
      readGoogleFlow(cookie, flow.nonce, origin, now)?.next,
      "/checkout/?plan=annual",
    );
    assert.equal(
      readGoogleFlow(cookie, flow.nonce, origin, now + 600001),
      null,
    );
    assert.equal(readGoogleFlow(cookie, flow.nonce, origin, now - 1), null);
    assert.equal(readGoogleFlow(cookie, "a".repeat(48), origin, now), null);
    assert.equal(
      readGoogleFlow(cookie, flow.nonce, "https://other.invalid", now),
      null,
    );
    assert.equal(readGoogleFlow("", flow.nonce, origin, now), null);
    assert.equal(
      readGoogleFlow(cookie + ".extra", flow.nonce, origin, now),
      null,
    );
    const [payload, mac] = cookie.split(".");
    const altered = Buffer.from(
      JSON.stringify({ ...flow, next: "/admin/" }),
    ).toString("base64url");
    assert.equal(
      readGoogleFlow(`${altered}.${mac}`, flow.nonce, origin, now),
      null,
    );
    const recoveryMac = createHmac("sha256", process.env.AUTH_RECOVERY_SECRET)
      .update(payload)
      .digest("hex");
    assert.equal(
      readGoogleFlow(`${payload}.${recoveryMac}`, flow.nonce, origin, now),
      null,
    );
    assert.notEqual(
      issueGoogleFlow("/account/", origin, now).flow.nonce,
      flow.nonce,
    );
  } finally {
    if (previous === undefined) delete process.env.AUTH_RECOVERY_SECRET;
    else process.env.AUTH_RECOVERY_SECRET = previous;
  }
});

test("Google sign-in rejects external destinations and recursive auth paths", () => {
  for (const path of [
    "https://attacker.invalid",
    "//attacker.invalid",
    "/\\attacker.invalid",
    "/login/",
    "/auth/callback/",
    "/api/auth/logout/",
  ])
    assert.equal(googleReturnPath(path), "/account/");
  assert.equal(
    googleReturnPath("/itineraries/?trip=one"),
    "/itineraries/?trip=one",
  );
  assert.equal(googleReturnPath("/admin/"), "/admin/");
});

test("OAuth redirects require the configured Supabase host, Google provider and PKCE", () => {
  const before = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    mode: process.env.UPD_DATA_MODE,
  };
  process.env.UPD_DATA_MODE = "supabase";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-public-key";
  try {
    const valid =
      "https://synthetic.supabase.co/auth/v1/authorize?provider=google&code_challenge=synthetic&code_challenge_method=s256";
    assert.equal(googleAuthorizeUrl(valid), valid);
    for (const invalid of [
      valid.replace(
        "synthetic.supabase.co",
        "synthetic.supabase.co.attacker.invalid",
      ),
      valid.replace("/authorize", "/logout"),
      valid.replace("provider=google", "provider=github"),
      valid.replace("s256", "plain"),
    ])
      assert.throws(() => googleAuthorizeUrl(invalid));
  } finally {
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: before.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: before.key,
      UPD_DATA_MODE: before.mode,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("OAuth callback origin cannot follow untrusted request hosts in production", () => {
  const environment: Record<string, string | undefined> = process.env;
  const before = { node: environment.NODE_ENV, app: environment.APP_URL };
  environment.APP_URL = "https://staging.example.invalid";
  try {
    environment.NODE_ENV = "production";
    assert.equal(
      authOrigin(new Request("https://attacker.invalid/auth/callback/")),
      environment.APP_URL,
    );
    environment.NODE_ENV = "development";
    assert.equal(
      authOrigin(new Request("http://localhost:3000/auth/callback/")),
      "http://localhost:3000",
    );
    assert.equal(
      authOrigin(new Request("http://127.0.0.1:3000/auth/callback/")),
      "http://127.0.0.1:3000",
    );
    assert.equal(
      authOrigin(new Request("http://attacker.invalid/auth/callback/")),
      environment.APP_URL,
    );
  } finally {
    if (before.node === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = before.node;
    if (before.app === undefined) delete environment.APP_URL;
    else environment.APP_URL = before.app;
  }
});
