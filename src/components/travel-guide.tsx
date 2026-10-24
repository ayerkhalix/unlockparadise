import type { Destination } from "@/lib/destinations";
import { safeHtml } from "@/lib/html";
import { paragraphs } from "@/lib/paragraphs";
export function TravelJourney({ place }: { place: Destination }) {
  const info = place.travel;
  if (!info?.boat_required) return null;
  return (
    <section className="p2-journey" aria-label="Journey by road and boat">
      <h2>Getting there by road and boat</h2>
      <ol>
        <li>
          <span className="p2-journey-dot" />
          <div>
            <strong>{info.journey_start || "City proper"}</strong>
            <p>
              Travel by road:{" "}
              {info.road_minutes != null
                ? `${info.road_minutes} min`
                : "duration unspecified"}
            </p>
          </div>
        </li>
        <li>
          <span className="p2-journey-dot" />
          <div>
            <strong>
              {info.departure_port ||
                "Departure port / access point unspecified"}
            </strong>
            <p>
              Boat ride:{" "}
              {info.boat_minutes != null
                ? `${info.boat_minutes} min`
                : "duration unspecified"}
            </p>
          </div>
        </li>
        <li>
          <span className="p2-journey-dot" />
          <div>
            <strong>{place.title}</strong>
          </div>
        </li>
      </ol>
      {info.travel_notes && (
        <p className="p2-travel-note">{info.travel_notes}</p>
      )}
    </section>
  );
}
export function EditorialGuide({ place }: { place: Destination }) {
  if (!place.introduction && !place.additionalContent) return null;
  return (
    <section className="p2-editorial" aria-labelledby="place-guide-title">
      <header>
        <span className="p2-eyebrow">Your destination guide</span>
        <h2 id="place-guide-title">A closer look at {place.title}</h2>
      </header>
      <div
        className="p2-guide-copy"
        dangerouslySetInnerHTML={{
          __html: safeHtml(paragraphs(place.introduction)),
        }}
      />
      {place.additionalContent && (
        <div
          className="p2-guide-copy p2-guide-copy--more"
          dangerouslySetInnerHTML={{
            __html: safeHtml(paragraphs(place.additionalContent)),
          }}
        />
      )}
      {!place.travel?.boat_required && place.travel?.travel_notes && (
        <aside className="p2-travel-note">
          <h3>Travel notes</h3>
          <p>{place.travel.travel_notes}</p>
        </aside>
      )}
    </section>
  );
}
