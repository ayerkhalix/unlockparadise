# Transportation data model

All new verified metadata lives in the existing RLS-protected `place_details` row. Legacy `places.travel_minutes`, accessibility choices and descriptions remain intact.

| Field             | Meaning                                   | Unknown value                          |
| ----------------- | ----------------------------------------- | -------------------------------------- |
| boat_required     | Explicit boat access requirement          | false until supported by source/editor |
| departure_port    | Verified wharf/access point name          | null                                   |
| road_minutes      | City-to-port road segment                 | null                                   |
| boat_minutes      | Boat segment                              | null                                   |
| hike_minutes      | Mountain hiking duration                  | null                                   |
| travel_notes      | Source-backed practical travel notes      | empty string                           |
| transport_minutes | Motorcycle, Car, 4x4 or Boat duration map | missing key/null                       |

Numeric durations allow 0–100000 minutes; transport JSON rejects unknown keys or non-numeric values. Admin saving validates input and persists these fields through the existing MFA-only Place transaction. Omitting new fields from an older API body preserves their values.

## Source-backed migration

The follow-up migration enables boat journeys only where imported accessibility is exactly `[Boat]`. This is a real access choice, not an inference from an Island/Beach category. It copies an access-point name only when that exact name appears in the original description: Honda Bay Wharf, Sabang Wharf, Manalo Beach, Buenavista Beach, Tagkawayan Nanka or Tagka-nanka.

Staging verification found **37** qualifying boat destinations and **33** explicit access-point names. No road or boat duration was backfilled. Generic travel time is not assumed to be boat time; ranges and ambiguous duration wording remain in the preserved guide. Editors can enter separately verified segment durations later.

## Presentation

Boat journeys show city proper → named/unspecified port → destination. Missing segments explicitly say duration unspecified. Mountain destinations label their main metric Hike time and use only hike_minutes; unknown values say Unspecified. Mountain transportation excludes Hike/Walking but preserves motorized accessibility choices, with duration information available by focus, hover and tap. Unknown transport durations are unspecified.

Descriptions retain all source content, warnings, fees, credits and links in a sanitized editorial section. Synthetic browser fixtures supply known values solely for testing and are removed afterward; they are not travel facts.
