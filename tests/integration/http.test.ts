import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyPaymongoSignature,
  sandboxKey,
  checkoutUrl,
} from "../../src/lib/payments/core";
import {
  safeRedirect,
  verifyOrigin,
  input,
  boundedBody,
  uploadForm,
} from "../../src/lib/http";
import { safeHtml } from "../../src/lib/html";
import { profileInput, reviewInput } from "../../src/lib/validation";
test("chunked bodies are bounded even with a false Content-Length; multipart data survives validation", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://local.test", {
    method: "POST",
    headers: { "content-length": "1" },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  await assert.rejects(
    () => boundedBody(request, 1500),
    (error: unknown) =>
      error instanceof Error && "status" in error && error.status === 413,
  );
  assert.equal(cancelled, true);
  const form = new FormData();
  form.set("name", "Synthetic");
  form.set(
    "file",
    new Blob(["synthetic-file"], { type: "image/jpeg" }),
    "synthetic.jpg",
  );
  const parsed = await uploadForm(
    new Request("https://local.test", { method: "POST", body: form }),
    4096,
  );
  assert.equal(parsed.get("name"), "Synthetic");
  assert.equal(await (parsed.get("file") as File).text(), "synthetic-file");
});
test("webhook signatures require the exact raw body, timestamp and test signature", () => {
  const now = 1800000000,
    raw = '{"synthetic":true}',
    secret = "synthetic-webhook-secret";
  const signature = createHmac("sha256", secret)
    .update(now + "." + raw)
    .digest("hex");
  assert.equal(
    verifyPaymongoSignature(raw, `t=${now},te=${signature}`, secret, now),
    true,
  );
  assert.equal(
    verifyPaymongoSignature(raw + " ", `t=${now},te=${signature}`, secret, now),
    false,
  );
  assert.equal(
    verifyPaymongoSignature(raw, `t=${now},li=${signature}`, secret, now),
    false,
  );
  assert.equal(
    verifyPaymongoSignature(raw, `t=${now},te=${signature}`, secret, now + 301),
    false,
  );
  assert.equal(
    verifyPaymongoSignature(raw, `t=${now},te=bad`, secret, now),
    false,
  );
  assert.throws(() => sandboxKey("sk_live_synthetic"));
  assert.throws(() => checkoutUrl("https://paymongo.com.attacker.test/"));
});
test("redirects and browser mutation origins are constrained", () => {
  for (const value of [
    "https://attacker.test",
    "//attacker.test",
    "/\\attacker.test",
    "/\r\nLocation: evil",
  ])
    assert.equal(safeRedirect(value), "/account/");
  assert.equal(safeRedirect("/portfolio/?sort=date"), "/portfolio/?sort=date");
  assert.throws(() =>
    verifyOrigin(
      new Request("https://local.test/api/", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
    ),
  );
  verifyOrigin(
    new Request("https://local.test/api/", {
      method: "POST",
      headers: { origin: "https://local.test" },
    }),
  );
});
test("development origins allow the configured loopback hostname alias only", () => {
  const environment: Record<string, string | undefined> = process.env;
  const previousAppUrl = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.APP_URL = "http://127.0.0.1:3000";
    environment.NODE_ENV = "development";
    verifyOrigin(
      new Request("http://127.0.0.1:3000/api/", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    assert.throws(() =>
      verifyOrigin(
        new Request("http://127.0.0.1:3000/api/", {
          method: "POST",
          headers: { origin: "http://localhost:3001" },
        }),
      ),
    );
    verifyOrigin(
      new Request("http://127.0.0.1:3001/api/", {
        method: "POST",
        headers: { origin: "http://localhost:3001" },
      }),
    );
    environment.NODE_ENV = "production";
    assert.throws(() =>
      verifyOrigin(
        new Request("http://127.0.0.1:3000/api/", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    );
  } finally {
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
    if (previousNodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousNodeEnv;
  }
});
test("untrusted profile privileges, oversized payloads and stored HTML are rejected or sanitized", async () => {
  assert.equal(
    profileInput.safeParse({
      display_name: "Explorer",
      role: "admin",
      premium: true,
    }).success,
    false,
  );
  assert.equal(
    reviewInput.safeParse({
      place_id: "00000000-0000-4000-8000-000000000001",
      rating: 6,
    }).success,
    false,
  );
  await assert.rejects(() =>
    input(
      new Request("https://local.test", {
        method: "POST",
        body: "a".repeat(70000),
      }),
      profileInput,
    ),
  );
  const html = safeHtml(
    '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">test</a><p>Safe</p>',
  );
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("onerror"));
  assert.ok(html.includes("<p>Safe</p>"));
});
