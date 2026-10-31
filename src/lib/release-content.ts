/** Exact fixture conventions only; never rename or delete customer content. */
export function isFixtureContent(place: { title?: string; slug?: string }) {
  return (
    /^\[test\](?:\s|$)/i.test(place.title || "") ||
    /^browsing-[a-f0-9]{6,}(?:\b|-)/i.test(place.slug || place.title || "")
  );
}
