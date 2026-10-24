import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  heroMarkup,
  card,
  archiveMarkup,
} from "../../src/lib/repositories/render";
import { fieldVisible, fieldHeading } from "../../src/lib/permissions/display";
import type { PlaceSummary } from "../../src/lib/repositories/places";
test("database summaries preserve card controls, ratings and safe presentation markup", () => {
  const place: PlaceSummary = {
    id: "00000000-0000-4000-8000-000000000001",
    legacy_id: 1,
    slug: "synthetic",
    title: "<script>unsafe</script>",
    vip_content: false,
    travel_minutes: 15,
    accessibility: ["Car"],
    assets: [],
    published_at: "2026-01-01T00:00:00Z",
    featured: false,
    feature_order: 0,
    place_areas: [],
    place_categories: [],
    place_media: [],
    saved: true,
    visited: true,
    rating_average: 4.5,
    rating_count: 2,
  };
  const html = card(place, "explorer-plus");
  assert.ok(!html.includes("<script>unsafe"));
  assert.ok(html.includes('data-member-op="unsave"'));
  assert.ok(!html.includes('data-member-op="unvisit"'));
  assert.ok(html.includes('data-rating="4.5"'));
  assert.ok(html.includes("upd-card__rating"));
  const templates = JSON.parse(readFileSync("src/data/fragments.json", "utf8"));
  const updated = archiveMarkup(
    templates["area/ppc-north/beaches"],
    [place],
    "explorer-plus",
  );
  assert.equal((updated.match(/class="upd-card"/g) || []).length, 1);
  assert.ok(updated.includes("upd-toolbar"));
});
test("homepage omits the removed category shortcut strip while detail visibility follows settings", () => {
  const templates = JSON.parse(readFileSync("src/data/fragments.json", "utf8"));
  const html = heroMarkup(templates.hero, {
    areas: [],
    categories: [{ slug: "beaches", name: "Beaches", image: "" }],
    availability: {},
    categoryCounts: { beaches: 123 },
  });
  assert.ok(!html.includes('class="upd-hero-cats"'));
  assert.ok(html.includes("upd-hero"));
  assert.equal(fieldVisible({ place_show_gallery: "0" }, "gallery"), false);
  assert.equal(fieldVisible({}, "gallery"), true);
  assert.equal(
    fieldHeading({ place_heading_gallery: "Photos" }, "gallery", "Gallery"),
    "Photos",
  );
});
