import assert from "node:assert/strict";
import { test } from "node:test";
import { overlappingStops } from "../../src/lib/itinerary-schedule";
test("overlap warnings cover containment and equal windows without flagging touching or flexible stops", () => {
  const overlaps = overlappingStops([
    { id: "morning", start_time: "08:00:00", end_time: "12:00:00" },
    { id: "inside", start_time: "09:00", end_time: "10:00" },
    { id: "same", start_time: "08:00", end_time: "12:00" },
    { id: "afternoon", start_time: "12:00", end_time: "13:00" },
    { id: "flexible", start_time: null, end_time: null },
  ]);
  assert.deepEqual(overlaps.get("morning"), ["inside", "same"]);
  assert.deepEqual(overlaps.get("inside"), ["morning", "same"]);
  assert.equal(overlaps.has("afternoon"), false);
  assert.equal(overlaps.has("flexible"), false);
});
