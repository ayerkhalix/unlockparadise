import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationInput } from "../../src/lib/auth/registration";
import {
  planningMapData,
  placesInMapCategory,
} from "../../src/lib/planning-map-data";
import type { TravelPlace } from "../../src/lib/planning";

test("registration requires a matching confirmation and a long password without trimming it", () => {
  const valid = {
    email: "example@example.invalid",
    password: "  long unique passphrase  ",
    confirm_password: "  long unique passphrase  ",
    terms: true,
  };
  assert.equal(registrationInput.parse(valid).password, valid.password);
  for (const invalid of [
    { ...valid, confirm_password: undefined },
    { ...valid, confirm_password: "different passphrase" },
    { ...valid, password: "short123", confirm_password: "short123" },
    { ...valid, email: "invalid-address" },
  ])
    assert.equal(registrationInput.safeParse(invalid).success, false);
});

test("planner map counts category and area memberships individually without adding restricted inventory", () => {
  const place: TravelPlace = {
    id: "one",
    slug: "one",
    title: "One",
    area: "El Nido · Puerto North",
    category: "Beaches · Islands",
    image: null,
    coordinates: [119, 10],
  };
  const data = planningMapData([place]);
  assert.equal(data.areas.length, 2);
  assert.equal(data.availability["el-nido"].beaches, 1);
  assert.equal(data.availability["ppc-north"].islands, 1);
  assert.equal(placesInMapCategory([place], "El Nido", "Islands").length, 1);
  assert.equal(
    placesInMapCategory([place], "Puerto South", "Islands").length,
    0,
  );
  assert.equal(planningMapData([]).areas.length, 0);
  const configured = planningMapData([place], {
    areas: [
      {
        name: "El Nido",
        slug: "el-nido",
        coords: [119.4, 11.2],
        desc: "Current area description",
      },
    ],
    categories: [
      { name: "Beaches", slug: "beaches", image: "/api/media/current-cover/" },
    ],
  });
  assert.deepEqual(
    configured.areas.find((a) => a.name === "El Nido")?.coords,
    [119.4, 11.2],
  );
  assert.equal(
    configured.categories.find((c) => c.name === "Beaches")?.image,
    "/api/media/current-cover/",
  );
});
