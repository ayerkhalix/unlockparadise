import { test } from "node:test";
import assert from "node:assert/strict";
import { planningPlace } from "../../src/lib/repositories/planning";
import { sourceFocalPoint } from "../../src/lib/focal-point";

test("planning galleries retain the cover crop when its photo also appears in the gallery", () => {
  const cover = "10000000-0000-4000-8000-000000000861",
    gallery = "10000000-0000-4000-8000-000000000862";
  const place = planningPlace({
    id: cover,
    slug: "gallery-check",
    title: "Gallery",
    status: "publish",
    vip_content: false,
    accessibility: [],
    travel_minutes: null,
    place_areas: [],
    place_categories: [],
    place_details: { latitude: null, longitude: null },
    place_media: [
      {
        kind: "gallery",
        position: 1,
        focal_x: 80,
        focal_y: 70,
        media: { id: cover, status: "ready" },
      },
      {
        kind: "cover",
        position: 0,
        focal_x: 20,
        focal_y: 30,
        media: { id: cover, status: "ready" },
      },
      {
        kind: "gallery",
        position: 2,
        focal_x: 60,
        focal_y: 70,
        media: { id: gallery, status: "ready" },
      },
      {
        kind: "gallery",
        position: 3,
        media: { id: "unavailable", status: "deleted" },
      },
    ],
  })!;
  assert.equal(place.images?.length, 2);
  assert.equal(place.images![0], place.image);
  assert.deepEqual(sourceFocalPoint(place.images![0]), { x: 20, y: 30 });
  assert.ok(place.images![1].includes(gallery));
});
