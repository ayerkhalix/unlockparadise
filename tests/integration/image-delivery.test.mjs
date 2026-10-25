import { test } from "node:test";
import assert from "node:assert/strict";
import {
  imageDeliveryUrl,
  responsiveImage,
} from "../../src/lib/image-delivery.ts";
test("image delivery keeps private images on the authenticated route and leaves unknown sources intact", () => {
  const media =
    "/api/media/10000000-0000-4000-8000-000000000581/?variant=medium_large";
  const response = responsiveImage(media);
  assert.ok(response.src.startsWith("/api/media/"));
  assert.ok(response.src.includes("variant=medium_large&width=640"));
  assert.ok(response.src.includes("resize=contain"));
  assert.ok(!response.srcSet.includes("/_next/image"));
  assert.equal(imageDeliveryUrl(media, 99999), media);
  for (const src of [
    "/api/previews/secret/",
    "https://untrusted.example/private.jpg",
    "data:image/png;base64,xx",
    "/original/logo.svg",
  ])
    assert.deepEqual(responsiveImage(src), { src });
  assert.ok(
    imageDeliveryUrl("/original/photo.jpg", 640).startsWith("/_next/image?"),
  );
});
