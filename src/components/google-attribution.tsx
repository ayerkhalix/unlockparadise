import type { GooglePlacePreview } from "@/lib/nearby-places";
export function GoogleAttribution({ place }: { place: GooglePlacePreview }) {
  return (
    <figcaption className="google-attribution">
      <a
        href={place.photoMapsUrl || place.mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        translate="no"
      >
        Google Maps
      </a>
      {[...place.authors, ...place.attributions].map((a, i) => (
        <span key={i} className="google-attribution__author">
          {"avatar" in a && typeof a.avatar === "string" && (
            <img src={a.avatar} width={18} height={18} alt="" loading="lazy" />
          )}
          {a.uri ? (
            <a href={a.uri} target="_blank" rel="noopener noreferrer">
              {a.name}
            </a>
          ) : (
            a.name
          )}
        </span>
      ))}
    </figcaption>
  );
}
