import { test } from "node:test";
import assert from "node:assert/strict";
import {
  xenditRequest,
  requireXenditSandbox,
  createXenditCheckout,
} from "../../src/lib/payments/xendit";

test("Xendit transport is sandbox-only, bounded and restricted to approved resources and accounts", async () => {
  const keys = [
    "UPD_ENVIRONMENT",
    "XENDIT_SECRET_KEY",
    "XENDIT_WEBHOOK_TOKEN",
    "XENDIT_TEST_USER_IDS",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const original = globalThis.fetch;
  let requests = 0;
  try {
    Object.assign(process.env, {
      UPD_ENVIRONMENT: "staging",
      XENDIT_SECRET_KEY: "xnd_development_synthetic",
      XENDIT_WEBHOOK_TOKEN: "synthetic-token",
      XENDIT_TEST_USER_IDS: "",
    });
    globalThis.fetch = async (resource, options) => {
      requests++;
      assert.equal(
        resource,
        "https://api.xendit.co/sessions/ps-661f87c614802d6c402cd82d",
      );
      assert.equal(options?.redirect, "error");
      assert.equal(options?.cache, "no-store");
      assert.ok(options?.signal);
      return Response.json({ status: "ACTIVE" });
    };
    await assert.rejects(
      () => createXenditCheckout("unapproved-account", "monthly", "key"),
      /not available for this account/,
    );
    await assert.rejects(
      () => xenditRequest("GET", "/sessions/../../balance"),
      /Invalid payment resource/,
    );
    assert.equal(requests, 0);
    assert.deepEqual(
      await xenditRequest("GET", "/sessions/ps-661f87c614802d6c402cd82d"),
      { status: "ACTIVE" },
    );
    assert.equal(requests, 1);
    process.env.XENDIT_SECRET_KEY = "xnd_production_synthetic";
    assert.throws(() => requireXenditSandbox(), /not configured/);
    process.env.XENDIT_SECRET_KEY = "xnd_development_synthetic";
    process.env.UPD_ENVIRONMENT = "production";
    assert.throws(() => requireXenditSandbox(), /not configured/);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = original;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
