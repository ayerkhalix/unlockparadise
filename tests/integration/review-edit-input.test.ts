import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewEditInput } from "../../src/lib/validation";
test("review edit input requires a precise version and rejects authority fields", () => {
  const input = {
    rating: 4,
    title: "Changed",
    body: "Body",
    updated_at: "2026-11-01T14:38:08.123456+00:00",
  };
  assert.equal(reviewEditInput.safeParse(input).success, true);
  assert.equal(
    reviewEditInput.safeParse({ ...input, updated_at: undefined }).success,
    false,
  );
  for (const extra of [
    { status: "approved" },
    { user_id: "other" },
    { place_id: "foreign" },
  ])
    assert.equal(
      reviewEditInput.safeParse({ ...input, ...extra }).success,
      false,
    );
});
