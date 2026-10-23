import { test } from "node:test";
import assert from "node:assert/strict";
import { tripDateLabel } from "../../src/lib/planning";

test("trip date ranges match across server and browser ICU whitespace", (t) => {
  t.mock.method(
    Intl.DateTimeFormat.prototype,
    "formatRange",
    () => "Oct 22\u2009–\u200923, 2026",
  );
  const server = tripDateLabel("2026-10-22", "2026-10-23");
  t.mock.restoreAll();
  t.mock.method(
    Intl.DateTimeFormat.prototype,
    "formatRange",
    () => "Oct 22 – 23, 2026",
  );
  const browser = tripDateLabel("2026-10-22", "2026-10-23");
  assert.equal(server, browser);
  assert.equal(browser, "Oct 22 – 23, 2026");
  assert.equal(tripDateLabel(null, null), "Dates are flexible");
});
