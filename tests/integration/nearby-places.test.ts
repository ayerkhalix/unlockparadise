import { test } from "node:test";
import assert from "node:assert/strict";
import {
  googleMapsUrl,
  mapsLookup,
  nearbyPlacesInput,
} from "../../src/lib/nearby-places";
import {
  lookupGoogleMaps,
  googlePlacePreview,
} from "../../src/lib/google-places";

test("Maps links reject arbitrary URLs, credentials, ports and non-Maps Google paths", () => {
  for (const value of [
    "http://www.google.com/maps/place/Cafe",
    "https://google.com.evil.test/maps/",
    "https://127.0.0.1/",
    "https://user@google.com/maps/",
    "https://google.com:444/maps/",
    "https://google.com/url?q=http://localhost",
    "https://goo.gl/anything",
    "javascript:alert(1)",
  ])
    assert.equal(googleMapsUrl(value), null, value);
  for (const value of [
    "https://maps.app.goo.gl/abc",
    "https://goo.gl/maps/abc",
    "https://www.google.com/maps/place/Local+Cafe/",
    "https://maps.google.com/?q=Local+Cafe",
  ])
    assert.ok(googleMapsUrl(value));
  assert.deepEqual(
    mapsLookup(
      new URL(
        "https://www.google.com/maps/search/?api=1&query=Coffee&query_place_id=ChIJabcdefghijk",
      ),
    ),
    { id: "ChIJabcdefghijk" },
  );
  assert.deepEqual(
    mapsLookup(new URL("https://www.google.com/maps/place/Local+Cafe/")),
    { query: "Local Cafe" },
  );
});
test("Nearby rows validate unique entries and exclude imported Google content", () => {
  const row = {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Local café",
    maps_url: "https://www.google.com/maps/place/Local+Cafe/",
    google_place_id: "",
    kind: "coffee",
    note: "A staff recommendation.",
  };
  assert.equal(nearbyPlacesInput.safeParse([row]).success, true);
  for (const rows of [
    [row, row],
    [{ ...row, maps_url: "https://example.com/" }],
    [{ ...row, name: " " }],
    [{ ...row, photo: "https://photo.invalid" }],
  ])
    assert.equal(nearbyPlacesInput.safeParse(rows).success, false);
});
test("Google lookup uses server key, live photo and author attribution; redirects cannot leave Maps", async (t) => {
  const originalFetch = global.fetch,
    originalKey = process.env.GOOGLE_PLACES_API_KEY;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  });
  delete process.env.GOOGLE_PLACES_API_KEY;
  await assert.rejects(
    () => lookupGoogleMaps("https://maps.app.goo.gl/test"),
    /not set up/,
  );
  process.env.GOOGLE_PLACES_API_KEY = "synthetic-server-key";
  const calls: string[] = [];
  global.fetch = (async (url, init) => {
    calls.push(String(url));
    if (String(url).startsWith("https://maps.app.goo.gl/"))
      return new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/secrets" },
      });
    assert.equal(
      (init?.headers as Record<string, string>)["X-Goog-Api-Key"],
      "synthetic-server-key",
    );
    assert.equal(init?.cache, "no-store");
    if (String(url).includes("/media?"))
      return Response.json({
        photoUri: "https://lh3.googleusercontent.com/example",
      });
    return Response.json({
      id: "ChIJabcdefghijk",
      displayName: { text: "Google café" },
      googleMapsUri: "https://www.google.com/maps/place/Cafe/",
      photos: [
        {
          name: "places/ChIJabcdefghijk/photos/photo_resource",
          googleMapsUri: "https://www.google.com/maps/place/Cafe/photo/example",
          authorAttributions: [
            {
              displayName: "Photographer",
              uri: "https://www.google.com/maps/contrib/123",
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  const result = await googlePlacePreview("ChIJabcdefghijk");
  assert.equal(result.photo, "https://lh3.googleusercontent.com/example");
  assert.equal(result.authors[0].name, "Photographer");
  assert.equal(
    result.photoMapsUrl,
    "https://www.google.com/maps/place/Cafe/photo/example",
  );
  assert.equal(JSON.stringify(result).includes("synthetic-server-key"), false);
  await assert.rejects(
    () => lookupGoogleMaps("https://maps.app.goo.gl/test"),
    /does not lead/,
  );
  assert.equal(
    calls.some((url) => url.includes("127.0.0.1")),
    false,
  );
});
