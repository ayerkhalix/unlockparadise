import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database } from "./database.mjs";
test("the actual WordPress content imports transactionally and is repeatable", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const sql = await readFile(
    "artifacts/backend-private/content-import.sql",
    "utf8",
  );
  const expected = JSON.parse(
    await readFile("artifacts/backend-private/content-manifest.json", "utf8"),
  );
  for (let run = 1; run <= 2; run++) {
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error("Content import failed: " + error.message);
    }
    for (const table of [
      "places",
      "place_details",
      "media",
      "media_files",
      "areas",
      "categories",
      "place_areas",
      "place_categories",
      "place_media",
      "taxonomy_media",
    ]) {
      const result = await db.query(
        `select count(*)::int as total from public.${table}`,
      );
      assert.equal(
        result.rows[0].total,
        expected[table]?.length || 0,
        table + " count on import " + run,
      );
    }
  }
  assert.equal(
    (await db.query("select id from public.places where legacy_id=5693")).rows
      .length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    0,
    "No customer identity import",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.media where status='ready'",
      )
    ).rows[0].n,
    0,
    "URLs alone do not prove uploaded objects",
  );
  const changed = (
    await db.query(
      "select count(*)::int as n from public.places where vip_content<>premium_content",
    )
  ).rows[0].n;
  assert.ok(changed > 90, "Both premium flags survive independently");
  const area = expected.areas.find((a) => a.slug === "ppc-north"),
    category = expected.categories.find((c) => c.slug === "beaches");
  const areaPlaces = new Set(
    expected.place_areas
      .filter((r) => r.area_id === area.id)
      .map((r) => r.place_id),
  );
  const categoryPlaces = new Set(
    expected.place_categories
      .filter((r) => r.category_id === category.id)
      .map((r) => r.place_id),
  );
  const expectedFiltered = expected.places
    .filter(
      (p) =>
        areaPlaces.has(p.id) &&
        categoryPlaces.has(p.id) &&
        p.listing_types.includes("destination"),
    )
    .map((p) => p.legacy_id)
    .sort((a, b) => a - b);
  const filtered = await db.query(
    "select legacy_id from public.find_places('ppc-north','beaches',null,false,500,0)",
  );
  assert.deepEqual(
    filtered.rows.map((p) => p.legacy_id).sort((a, b) => a - b),
    expectedFiltered,
  );
  const search = await db.query(
    "select title from public.find_places(null,null,'Mandyukot',false,100,0)",
  );
  assert.ok(search.rows.length > 0);
  assert.ok(
    search.rows.every((p) => p.title.toLowerCase().includes("mandyukot")),
  );
  const featured = await db.query(
    "select featured from public.find_places(null,null,null,true,100,0)",
  );
  assert.ok(featured.rows.length > 0);
  assert.ok(featured.rows.every((p) => p.featured));
  for (const sample of expected.place_details
    .filter((p) => p.latitude !== null)
    .slice(0, 10)) {
    const result = await db.query(
      "select latitude::float8,longitude::float8 from public.place_details where place_id=$1",
      [sample.place_id],
    );
    assert.ok(Math.abs(result.rows[0].latitude - sample.latitude) < 1e-8);
    assert.ok(Math.abs(result.rows[0].longitude - sample.longitude) < 1e-8);
  }
  console.log(
    "Reconciled 383 Places, independent premium flags, taxonomy links, ordered gallery links and attachment metadata across two real imports.",
  );
});
