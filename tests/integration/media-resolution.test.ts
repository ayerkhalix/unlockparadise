import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyPublicUrl, mediaAvailable } from "../../src/lib/media-availability";
import { legacyImage } from "../../src/lib/storage/legacy";
test("legacy media URLs retain paths while rejecting traversal and external redirects", () => {
  assert.equal(legacyPublicUrl("https://example.test/wp-content/uploads/", "2026/07/photo one.jpg"), "https://example.test/wp-content/uploads/2026/07/photo%20one.jpg");
  for (const value of ["../secret", "/file.jpg", "https://evil.test/file", "a/../../x", "a%2f..%2fx", "a\\file", "a?key=x"])
    assert.throws(() => legacyPublicUrl("https://example.test/", value));
  assert.equal(mediaAvailable({ status: "legacy" }), true);
  assert.equal(mediaAvailable({ status: "pending" }), false);
});
test("private legacy delivery never redirects to a public origin without a private source", async () => {
  const previous = process.env.LEGACY_PRIVATE_MEDIA_MODE;
  process.env.LEGACY_PRIVATE_MEDIA_MODE = "unavailable";
  try {
    const response = await legacyImage({ bucket: "destination-private", original_path: "2026/07/private.jpg", mime_type: "image/jpeg", checksum: null });
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("cache-control"), "private,no-store");
    assert.match(await response.text(), /Photo unavailable/);
  } finally { if (previous === undefined) delete process.env.LEGACY_PRIVATE_MEDIA_MODE; else process.env.LEGACY_PRIVATE_MEDIA_MODE = previous; }
});
