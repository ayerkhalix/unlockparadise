import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAccountEmails,
  signUpWithConfirmation,
} from "../../src/lib/auth/signup";
import { ApiError } from "../../src/lib/http";

test("public email signup retains the delivery switch without a staging inbox allowlist", () => {
  const saved = { ...process.env };
  try {
    process.env.UPD_ENVIRONMENT = "staging";
    process.env.AUTH_ALLOWED_EMAILS = "old-test@example.invalid";
    process.env.AUTH_EMAILS_ENABLED = "true";
    assert.doesNotThrow(requireAccountEmails);
    process.env.AUTH_EMAILS_ENABLED = "false";
    assert.throws(
      requireAccountEmails,
      (e: unknown) => e instanceof ApiError && e.status === 503,
    );
  } finally {
    for (const key of [
      "UPD_ENVIRONMENT",
      "AUTH_ALLOWED_EMAILS",
      "AUTH_EMAILS_ENABLED",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test("a new public address receives confirmation instructions without a session redirect", async () => {
  let input: unknown;
  const db = {
    auth: {
      signUp: async (value: unknown) => {
        input = value;
        return {
          data: { user: { id: "synthetic" }, session: null },
          error: null,
        };
      },
    },
  } as unknown as SupabaseClient;
  const details = {
    email: "new-visitor@example.invalid",
    password: "  long unique password  ",
  };
  const redirect = "https://staging.example.invalid/auth/confirm/";
  assert.deepEqual(await signUpWithConfirmation(db, details, redirect), {
    message: "Check your email to confirm your account.",
  });
  assert.deepEqual(input, {
    ...details,
    options: { emailRedirectTo: redirect, data: { terms_accepted: true } },
  });
});

test("provider mail restrictions and outages do not falsely report that mail was sent", async () => {
  for (const code of [
    "email_address_not_authorized",
    "over_email_send_rate_limit",
    "unexpected_failure",
  ]) {
    const db = {
      auth: {
        signUp: async () => ({
          data: {},
          error: { code, message: "provider details" },
        }),
      },
    } as unknown as SupabaseClient;
    await assert.rejects(
      signUpWithConfirmation(
        db,
        { email: "visitor@example.invalid", password: "synthetic password" },
        "https://staging.example.invalid/auth/confirm/",
      ),
      (e: unknown) =>
        e instanceof ApiError &&
        e.status === 503 &&
        !e.message.includes("provider details"),
    );
  }
});

test("an accidental provider auto-confirm setting cannot silently sign the browser in", async () => {
  let signedOut = false;
  const db = {
    auth: {
      signUp: async () => ({
        data: { session: { access_token: "synthetic" } },
        error: null,
      }),
      signOut: async ({ scope }: { scope: string }) => {
        assert.equal(scope, "local");
        signedOut = true;
      },
    },
  } as unknown as SupabaseClient;
  await assert.rejects(
    signUpWithConfirmation(
      db,
      { email: "visitor@example.invalid", password: "synthetic password" },
      "https://staging.example.invalid/auth/confirm/",
    ),
    (e: unknown) => e instanceof ApiError && e.status === 503,
  );
  assert.equal(signedOut, true);
});
