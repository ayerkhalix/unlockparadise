import { test } from "node:test";
import assert from "node:assert/strict";
import { placeInput } from "../../src/lib/validation";
import { centavos, averageCentavos } from "../../src/lib/commerce";
test("Place concurrency timestamps accept Supabase offset and microsecond precision", () => {
  const body = {
    title: "Synthetic",
    slug: "synthetic",
    status: "draft",
    vip_content: false,
    premium_content: false,
    listing_types: ["destination"],
    travel_minutes: null,
    accessibility: [],
    assets: [],
    featured: false,
    feature_order: 0,
    description: "",
    latitude: null,
    longitude: null,
    weekday_crowd: "",
    weekend_crowd: "",
    area_ids: [],
    category_ids: [],
    gallery: [],
    cover_id: null,
    expected_updated_at: "2026-10-19T15:58:01.320123+00:00",
  };
  assert.equal(
    placeInput.parse(body).expected_updated_at,
    body.expected_updated_at,
  );
  assert.equal(
    placeInput.safeParse({ ...body, expected_updated_at: "2026-10-19 15:58" })
      .success,
    false,
  );
});
test("PHP amount parsing and rounded averages operate on integer centavos", () => {
  assert.equal(centavos("123.45"), 12345);
  assert.equal(centavos("0.10") + centavos("0.20"), 30);
  assert.equal(averageCentavos(101, 2), 51);
  assert.equal(averageCentavos(100, 3), 33);
  for (const bad of ["1.001", "-1", "1e3", "NaN", "1000001.00"])
    assert.throws(() => centavos(bad));
});
