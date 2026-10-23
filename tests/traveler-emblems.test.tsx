import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  TravelerEmblem,
  travelerEmblemKey,
} from "../src/components/traveler-emblem";
import { interestKeys } from "../src/lib/traveler";
test("all 63 identities render different interest-specific emblem compositions", () => {
  const artworks = new Set<string>();
  for (let mask = 1; mask < 64; mask++) {
    const selected = interestKeys.filter((_, index) => mask & (1 << index));
    assert.equal(travelerEmblemKey(selected), mask);
    assert.equal(travelerEmblemKey([...selected].reverse()), mask);
    const svg = renderToStaticMarkup(
      createElement(TravelerEmblem, { selected }),
    );
    for (const key of selected) assert.ok(svg.includes(`emblem-motif--${key}`));
    assert.ok(svg.includes('aria-hidden="true"'));
    artworks.add(svg.replace(/data-identity-mask="\d+"/, ""));
  }
  assert.equal(artworks.size, 63);
  assert.equal(travelerEmblemKey(["island", "beach"]), 1);
});
