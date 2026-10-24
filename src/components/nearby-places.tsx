import { ContentImage } from "@/components/ui/content-image";
import { serverSupabase } from "@/lib/supabase/server";
import { databaseError } from "@/lib/http";
import {
  googlePlacePreview,
  googlePlacesConfigured,
} from "@/lib/google-places";
import { nearbyPlacesInput, nearbyKindLabels } from "@/lib/nearby-places";
import { GoogleAttribution } from "./google-attribution";

export async function NearbyPlaces({ placeId }: { placeId: string }) {
  const db = await serverSupabase();
  const result = await db
    .from("place_details")
    .select("nearby_places")
    .eq("place_id", placeId)
    .maybeSingle();
  databaseError(result.error);
  const parsed = nearbyPlacesInput.safeParse(result.data?.nearby_places || []);
  if (!parsed.success || !parsed.data.length) return null;
  const places = await Promise.all(
    parsed.data.map(async (place) => {
      const google =
        place.google_place_id && googlePlacesConfigured()
          ? await googlePlacePreview(place.google_place_id).catch(() => null)
          : null;
      return { place, google };
    }),
  );
  return (
    <section
      className="place-section nearby-places"
      aria-labelledby="nearby-places-title"
    >
      <div className="nearby-places__heading">
        <h2 id="nearby-places-title">Recommended nearby</h2>
        <p>Local stops selected by Unlock Paradise.</p>
      </div>
      <ul className="nearby-places__list">
        {places.map(({ place, google }) => (
          <li key={place.id}>
            {google?.photo && (
              <figure>
                <a
                  href={google.photoMapsUrl || place.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${place.name} on Google Maps`}
                >
                  <ContentImage
                    src={google.photo}
                    alt=""
                    loading="lazy"
                    width={240}
                    height={168}
                  />
                </a>
                <GoogleAttribution place={google} />
              </figure>
            )}
            <div className="nearby-places__body">
              <span className="nearby-places__kind">
                {nearbyKindLabels[place.kind]}
              </span>
              <h3>
                <a
                  href={place.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {place.name}
                </a>
              </h3>
              {google?.address && (
                <p className="nearby-places__address">{google.address}</p>
              )}
              {place.note && <p>{place.note}</p>}
              <a
                className="nearby-places__maps"
                href={place.maps_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Maps <span aria-hidden="true">↗</span>
              </a>
              {google && !google.photo && (
                <figure className="nearby-places__attribution-only">
                  <GoogleAttribution place={google} />
                </figure>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
