import type { Destination } from "@/lib/destinations";
import { safeHtml } from "@/lib/html";
import { Icon } from "./icon";
import { ReviewControls } from "./place-actions";
import { TravelerBadges } from "./traveler-identity";
import { ContentImage } from "./ui/content-image";

export function ReviewCard({
  review,
  viewerId,
  returnTo,
}: {
  review: Destination["reviews"][number];
  viewerId?: string;
  returnTo: string;
}) {
  const date = new Date(review.date);
  const initials =
    review.author
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <article className="upd-review">
      <header className="upd-review__header">
        <span className="upd-review__avatar" aria-hidden="true">
          {review.avatar ? (
            <ContentImage
              src={review.avatar}
              sizes="64px"
              width={64}
              height={64}
              alt=""
              loading="lazy"
            />
          ) : (
            initials
          )}
        </span>
        <div className="upd-review__author">
          <strong>{review.author}</strong>
          {review.rating > 0 && (
            <span
              className="upd-review__rating"
              role="img"
              aria-label={`${review.rating} out of 5 stars`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} data-filled={i < review.rating}>
                  <Icon name="StarFilled" size={22} />
                </span>
              ))}
            </span>
          )}
          {review.travelerIdentity && (
            <TravelerBadges identity={review.travelerIdentity} />
          )}
          {!Number.isNaN(date.getTime()) && (
            <time dateTime={date.toISOString()}>
              {new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeZone: "Asia/Manila",
              }).format(date)}
            </time>
          )}
        </div>
      </header>
      {review.title && <h3>{review.title}</h3>}
      {review.approved === false && (
        <p className="upd-review-msg">Your review is awaiting approval.</p>
      )}
      <div
        className="upd-review__body"
        dangerouslySetInnerHTML={{ __html: safeHtml(review.body) }}
      />
      {review.id &&
        (viewerId ? (
          <ReviewControls
            id={review.id}
            own={review.userId === viewerId}
            initialLikes={review.likes}
            initialLiked={review.liked}
          />
        ) : (
          <div className="upd-review-actions">
            <a
              className="upd-like"
              href={`/login/?redirect_to=${encodeURIComponent(returnTo)}`}
              aria-label="Sign in to like this review"
            >
              <Icon name="Heart" size={24} />
              {review.likes ? <span>{review.likes}</span> : null}
            </a>
          </div>
        ))}
    </article>
  );
}
