import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { validatedImage } from "../../src/lib/storage/images";
import {
  recoveryGrant,
  verifyRecoveryGrant,
} from "../../src/lib/auth/recovery";
test("profile uploads are decoded, stripped, square-cropped and bounded", async () => {
  const bytes = await sharp({
    create: { width: 240, height: 360, channels: 3, background: "#337788" },
  })
    .withMetadata()
    .jpeg()
    .toBuffer();
  const file = new File([bytes], "synthetic.jpg", { type: "image/jpeg" });
  const result = await validatedImage(file, { avatar: true });
  const metadata = await sharp(result.data).metadata();
  assert.equal(metadata.width, 192);
  assert.equal(metadata.height, 192);
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  await assert.rejects(() =>
    validatedImage(
      new File(["<script>bad</script>"], "photo.jpg", { type: "image/jpeg" }),
      { avatar: true },
    ),
  );
  await assert.rejects(() =>
    validatedImage(
      new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.jpg", {
        type: "image/jpeg",
      }),
      { avatar: true },
    ),
  );
});
test("recovery grants require the same user, secret and fresh expiry", () => {
  process.env.AUTH_RECOVERY_SECRET =
    "synthetic-secret-that-is-longer-than-thirty-two-characters";
  const user = "00000000-0000-4000-8000-000000000001",
    now = 1800000000000;
  const grant = recoveryGrant(user, now);
  assert.equal(verifyRecoveryGrant(grant, user, now + 1000), true);
  assert.equal(verifyRecoveryGrant(grant, user, now + 600001), false);
  assert.equal(verifyRecoveryGrant(grant, "different", now), false);
  assert.equal(verifyRecoveryGrant(grant.replace(/.$/, "z"), user, now), false);
  delete process.env.AUTH_RECOVERY_SECRET;
});
