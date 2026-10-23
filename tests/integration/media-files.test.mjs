import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  fileMime,
  validMime,
} from "../../scripts/migration/file-validation.mjs";
test("migration file validation uses file signatures rather than trusting a filename", async () => {
  const jpeg = await sharp({
    create: { width: 5, height: 5, channels: 3, background: "#123456" },
  })
    .jpeg()
    .toBuffer();
  assert.equal(fileMime(jpeg), "image/jpeg");
  assert.equal(validMime(jpeg, "image/heic"), false);
  assert.equal(
    validMime(Buffer.from("<html>not an image</html>"), "image/jpeg"),
    false,
  );
  const heic = Buffer.alloc(24);
  heic.write("ftyp", 4);
  heic.write("heic", 8);
  assert.equal(fileMime(heic), "image/heic");
});
