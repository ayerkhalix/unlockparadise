import type { Destination, Tier } from "@/lib/destinations";
import { Gallery } from "./gallery";
import { DestinationLocation } from "./destination-location";
import { Icon } from "./icon";
import { PlaceActions, ReviewForm, ReviewControls } from "./place-actions";
import { currentSession } from "@/lib/auth/session";
import { safeHtml } from "@/lib/html";
import { localAsset } from "@/lib/content";
import mapData from "@/data/map.json";
import { TravelJourney, EditorialGuide } from "./travel-guide";
import { Recommendations } from "./recommendations";
import { NearbyPlaces } from "./nearby-places";
import {
  fieldVisible,
  fieldHeading,
  fieldDescription,
} from "@/lib/permissions/display";
import { backendConfigured } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { databaseError } from "@/lib/http";
import { InterestView } from "./analytics-preferences";
import { TravelerBadges } from "./traveler-identity";

function Fact({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="upd-place-card">
      <span className="upd-place-card__icon">
        <Icon name={icon} size={28} />
      </span>
      <span className="upd-place-card__label">{label}</span>
      {children}
    </div>
  );
}
function Pill({
  label,
  icon,
  description,
}: {
  label: string;
  icon: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      className="upd-asset-pill"
      data-tooltip={
        description || (label.includes(": ") ? label.split(": ").at(-1) : label)
      }
      aria-label={label}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
export async function DestinationDetail({
  place,
  tier,
}: {
  place: Destination;
  tier: Tier;
}) {
  const current = await currentSession();
  const db =
    current?.db || (backendConfigured() ? await serverSupabase() : null);
  const displayResult = db
    ? await db
        .from("app_settings")
        .select("key,value")
        .in("key", ["place_display", "asset_descriptions"])
    : null;
  databaseError(displayResult?.error || null);
  const display: Record<string, unknown> = Object.assign(
    {},
    ...(displayResult?.data || []).map((row) => row.value),
  );
  const show = (field: string) => fieldVisible(display, field);
  const state =
    place.uuid && current
      ? (
          await current.db
            .from("member_places")
            .select("saved_at,visited_at")
            .eq("user_id", current.user.id)
            .eq("place_id", place.uuid)
            .maybeSingle()
        ).data
      : null;
  const own = place.reviews.some((r) => r.userId === current?.user.id);
  const area = place.areaName
    ? { name: place.areaName, slug: place.area }
    : mapData.areas.find((a) => a.slug === place.area);
  const category = place.categoryName
    ? { name: place.categoryName, slug: place.category }
    : mapData.categories.find((c) => c.slug === place.category);
  const mountain = place.isMountain || place.category === "mountain-hikes";
  const transport = mountain
    ? place.accessibility.filter(
        (label) =>
          !["hike", "hiking", "walking", "walk"].includes(label.toLowerCase()),
      )
    : place.accessibility;
  const visibleTravel =
    show("travel_time") && (mountain || place.travelTime !== null);
  const visibleAccess = show("accessible_by") && transport.length > 0;
  const visibleAssets = show("assets") && place.assets.length > 0;
  const visibleWeekdays = show("weekdays_crowd") && !!place.weekdayCrowd;
  const visibleWeekends = show("weekends_crowd") && !!place.weekendCrowd;
  const hasFacts =
    visibleTravel ||
    visibleAccess ||
    visibleAssets ||
    visibleWeekdays ||
    visibleWeekends;
  return (
    <main className="upd-main" id="upd-main">
      {place.uuid && <InterestView placeId={place.uuid} />}
      <div className="upd-container">
        <article className="place-single">
          <a
            className="upd-place-return upd-place-return--plain"
            href={
              area
                ? `/area/${place.area}/${place.category ? place.category + "/" : ""}`
                : "/"
            }
          >
            ‹ Return
          </a>
          <div className="place-eyebrow">
            {area?.name}
            {area && category ? " › " : ""}
            {category?.name}
          </div>
          <h1 className="place-title">{place.title}</h1>
          <PlaceActions
            premium={tier === "explorer-plus"}
            placeId={place.uuid}
            saved={Boolean(state?.saved_at)}
            visited={Boolean(state?.visited_at)}
          />
          {hasFacts && (
            <div className="upd-place-details">
              {visibleTravel && (
                <Fact
                  icon="Clock"
                  label={mountain ? "Hike time" : "Travel time"}
                >
                  <span className="upd-place-card__value">
                    {mountain
                      ? place.travel?.hike_minutes != null
                        ? `${place.travel.hike_minutes} min`
                        : "Unspecified"
                      : `${place.travelTime} min`}
                  </span>
                </Fact>
              )}
              {visibleAccess && (
                <Fact icon="Directions" label="Accessibility">
                  <div className="upd-place-card__pills">
                    {transport.map((label) => (
                      <Pill
                        key={label}
                        label={`${label} — ${place.travel?.transport_minutes[label] != null ? `${place.travel.transport_minutes[label]} min` : "duration unspecified"}`}
                        icon={label}
                        description={`${label} — ${place.travel?.transport_minutes[label] != null ? `${place.travel.transport_minutes[label]} min` : "duration unspecified"}${fieldDescription(display, "access", label) ? `. ${fieldDescription(display, "access", label)}` : ""}`}
                      />
                    ))}
                  </div>
                </Fact>
              )}
              {(visibleWeekdays || visibleWeekends) && (
                <Fact icon="People" label="Crowd density">
                  <div className="upd-place-card__pills">
                    {visibleWeekdays && (
                      <Pill
                        label={`Weekdays: ${place.weekdayCrowd}`}
                        icon={
                          place.weekdayCrowd === "Uncrowded"
                            ? "Person"
                            : "People"
                        }
                      />
                    )}
                    {visibleWeekends && (
                      <Pill
                        label={`Weekends: ${place.weekendCrowd}`}
                        icon={
                          place.weekendCrowd === "Uncrowded"
                            ? "Person"
                            : "People"
                        }
                      />
                    )}
                  </div>
                </Fact>
              )}
              {visibleAssets && (
                <Fact icon="Star" label="Assets">
                  <div className="upd-place-card__pills">
                    {place.assets.map((label) => (
                      <Pill
                        key={label}
                        label={label}
                        description={fieldDescription(display, "asset", label)}
                        icon={
                          label === "Accommodation available"
                            ? "Accommodation"
                            : label === "Sunset view"
                              ? "Sunset"
                              : label === "Sunrise view"
                                ? "Sunrise"
                                : label === "Surfing spot"
                                  ? "Surfing"
                                  : label
                        }
                      />
                    ))}
                  </div>
                </Fact>
              )}
            </div>
          )}
          <TravelJourney place={place} />
          {show("description") && <EditorialGuide place={place} />}
          {place.gallery.length > 0 && show("gallery") && (
            <section className="place-section">
              <h2>{fieldHeading(display, "gallery", "Gallery")}</h2>
              <Gallery
                title={place.title}
                images={place.gallery.map(localAsset)}
              />
            </section>
          )}
          {place.coordinates && show("area_location") && (
            <section className="place-section">
              <h2>{fieldHeading(display, "area_location", "Location")}</h2>
              <DestinationLocation
                coordinates={place.coordinates as [number, number]}
                accessPoints={place.accessPoints}
                zoom={Number(display.place_mapzoom_area_location) || 14}
              />
            </section>
          )}
          {place.uuid && backendConfigured() && <NearbyPlaces placeId={place.uuid} />}
          <section className="upd-reviews-section" id="reviews">
            <h2 className="upd-reviews-section__title">Reviews</h2>
            {place.reviews.length ? (
              <div className="upd-reviews-list">
                {place.reviews.map((review, i) => (
                  <article key={review.id || i} className="upd-review">
                    <strong>{review.author}</strong>
                    {review.travelerIdentity && (
                      <TravelerBadges identity={review.travelerIdentity} />
                    )}
                    {review.rating > 0 && (
                      <span aria-label={`${review.rating} out of 5 stars`}>
                        {"★".repeat(review.rating)}
                      </span>
                    )}
                    {review.title && <h3>{review.title}</h3>}
                    {review.approved === false && (
                      <p className="upd-review-msg">
                        Your review is awaiting approval.
                      </p>
                    )}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: safeHtml(review.body),
                      }}
                    />
                    {review.id && current && (
                      <ReviewControls
                        id={review.id}
                        own={review.userId === current.user.id}
                        initialLikes={review.likes}
                        initialLiked={review.liked}
                      />
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="upd-reviews-empty">
                No reviews yet. <strong>Be the first to visit!</strong>
              </p>
            )}
            {!own && <ReviewForm placeId={current ? place.uuid : undefined} />}
          </section>
          {place.uuid && backendConfigured() && (
            <Recommendations placeId={place.uuid} />
          )}
        </article>
      </div>
    </main>
  );
}
