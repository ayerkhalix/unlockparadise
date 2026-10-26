import { test } from "node:test";
import assert from "node:assert/strict";
import {
  libraryFilters,
  libraryHref,
  safeLibraryReturn,
} from "../../src/lib/itinerary-library";
import { plannerHref } from "../../src/lib/planning";

test("library URLs retain committed filters and reject editor or external return targets", () => {
  const area = "20000000-0000-4000-8000-000000000201";
  const state = libraryFilters({
    q: "  Beach & coffee  ",
    area,
    sort: "name",
    page: "12",
  });
  const href = libraryHref(state);
  assert.deepEqual(
    libraryFilters(
      Object.fromEntries(new URL(href, "https://local.invalid").searchParams),
    ),
    state,
  );
  assert.equal(safeLibraryReturn(href), href);
  assert.equal(
    new URL(
      plannerHref("trip", "day", href),
      "https://local.invalid",
    ).searchParams.get("return_to"),
    href,
  );
  for (const value of [
    "https://evil.test/itineraries/",
    "//evil.test/itineraries/",
    "/\\evil.test/itineraries/",
    "/itineraries/explore/",
    "/itineraries/?trip=private",
    "/itineraries/?create=1",
    "/account/",
    "/itineraries/\n",
  ]) {
    assert.equal(safeLibraryReturn(value), null);
    assert.equal(
      new URL(
        plannerHref("trip", undefined, value),
        "https://local.invalid",
      ).searchParams.has("return_to"),
      false,
    );
  }
  assert.deepEqual(
    libraryFilters({
      q: "x".repeat(121),
      area: "invalid",
      sort: "drop table",
      page: "-1",
    }),
    { q: "", area: "", sort: "recent", page: 1 },
  );
  assert.equal(libraryHref(libraryFilters({})), "/itineraries/");
  assert.equal(
    safeLibraryReturn("/itineraries/?page=2&unknown=secret"),
    "/itineraries/?page=2",
  );
});
