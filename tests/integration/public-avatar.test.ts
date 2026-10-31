import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicAvatar } from "../../src/lib/public-avatar";
import { isFixtureContent } from "../../src/lib/release-content";

const approved = {
  status: "ready",
  bucket: "profile-private",
  object_path: "private-owner/avatar.webp",
  mime_type: "image/webp",
  checksum: "abc123",
};
function source(photo: typeof approved | null, fail = false) {
  let downloads = 0;
  const service = {
    from(table: string) {
      assert.equal(table, "profile_media");
      return {
        select() {
          return {
            eq(column: string, id: string) {
              assert.equal(column, "media_id");
              assert.equal(id, "avatar-id");
              return {
                async maybeSingle() {
                  return { data: photo ? { media: photo } : null, error: null };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        assert.equal(bucket, "profile-private");
        return {
          async download(path: string) {
            downloads++;
            assert.equal(path, approved.object_path);
            return fail
              ? { data: null, error: { message: "Private storage error" } }
              : {
                  data: new Blob(["avatar-bytes"], { type: "image/webp" }),
                  error: null,
                };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { service, downloads: () => downloads };
}
test("public avatar serves image bytes without exposing the storage location", async () => {
  const s = source(approved);
  const r = await publicAvatar(
    new Request("https://example.com/api/avatars/avatar-id/"),
    "avatar-id",
    s.service,
  );
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "avatar-bytes");
  assert.equal(r.headers.get("location"), null);
  assert.equal(r.headers.get("content-type"), "image/webp");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(s.downloads(), 1);
});
test("only an associated ready profile picture is public", async () => {
  for (const photo of [
    null,
    { ...approved, status: "pending" },
    { ...approved, status: "deleted" },
    { ...approved, bucket: "destination-private" },
    { ...approved, mime_type: "image/svg+xml" },
  ]) {
    const s = source(photo);
    await assert.rejects(
      publicAvatar(new Request("https://example.com"), "avatar-id", s.service),
      { status: 404 },
    );
    assert.equal(s.downloads(), 0);
  }
});
test("avatar conditional requests still re-check the current association", async () => {
  const request = new Request("https://example.com", {
    headers: { "If-None-Match": '"abc123"' },
  });
  const s = source(approved);
  assert.equal(
    (await publicAvatar(request, "avatar-id", s.service)).status,
    304,
  );
  assert.equal(s.downloads(), 0);
  const absent = source(null);
  await assert.rejects(publicAvatar(request, "avatar-id", absent.service), {
    status: 404,
  });
});
test("avatar storage failures have a recoverable generic message", async () => {
  await assert.rejects(
    publicAvatar(
      new Request("https://example.com"),
      "avatar-id",
      source(approved, true).service,
    ),
    { status: 503, message: "Profile photo unavailable." },
  );
});
test("release exclusion recognizes fixtures without hiding ordinary destination names", () => {
  assert.equal(
    isFixtureContent({ title: "[TEST] Staging acceptance edited" }),
    true,
  );
  assert.equal(isFixtureContent({ slug: "browsing-4fb93c3f-place" }), true);
  for (const title of [
    "Test Valley",
    "Testing Beach",
    "browsing-beach",
    "Latest sunset",
  ])
    assert.equal(isFixtureContent({ title }), false);
});
