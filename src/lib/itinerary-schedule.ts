import type { TripItem } from "./planning";

/** Same-day local times. Touching endpoints leave no overlap; flexible stops are excluded. */
export function overlappingStops(
  stops: Pick<TripItem, "id" | "start_time" | "end_time">[],
) {
  const conflicts = new Map<string, string[]>();
  for (let i = 0; i < stops.length; i++) {
    const a = stops[i];
    if (!a.start_time || !a.end_time) continue;
    for (let j = i + 1; j < stops.length; j++) {
      const b = stops[j];
      if (!b.start_time || !b.end_time) continue;
      if (
        a.start_time.slice(0, 5) < b.end_time.slice(0, 5) &&
        b.start_time.slice(0, 5) < a.end_time.slice(0, 5)
      ) {
        conflicts.set(a.id, [...(conflicts.get(a.id) || []), b.id]);
        conflicts.set(b.id, [...(conflicts.get(b.id) || []), a.id]);
      }
    }
  }
  return conflicts;
}
