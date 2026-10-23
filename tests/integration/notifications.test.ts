import { test } from "node:test";
import assert from "node:assert/strict";
import { membershipEmail } from "../../src/lib/notifications/templates";
test("membership email templates preserve pay-once wording and Philippine dates", () => {
  const welcome = membershipEmail(
    "welcome",
    "2026-10-18T20:00:00Z",
    "https://staging.example.test",
  );
  assert.ok(welcome.text.includes("19 October 2026"));
  assert.ok(welcome.text.includes("no automatic charges"));
  for (const template of [
    "welcome",
    "extended",
    "reminder",
    "ended",
  ] as const) {
    const value = membershipEmail(
      template,
      "2026-10-18T20:00:00Z",
      "https://staging.example.test",
    );
    assert.ok(value.subject);
    assert.ok(value.text.includes("https://staging.example.test/account/"));
  }
});
