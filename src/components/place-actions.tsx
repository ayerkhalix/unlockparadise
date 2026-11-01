"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useState } from "react";
import { Icon } from "./icon";
import { useRouter } from "next/navigation";
import { notify, requestJSON } from "@/lib/client-api";

export function PlaceActions({
  premium,
  placeId,
  saved = false,
}: {
  premium: boolean;
  placeId?: string;
  saved?: boolean;
  visited?: boolean;
}) {
  const [shared, setShared] = useState(false);
  return (
    <div className="upd-place__actions">
      {premium && (
        <>
          <button
            type="button"
            className={`upd-action${saved ? " is-saved" : ""}`}
            disabled={!placeId}
            data-member-op={saved ? "unsave" : "save"}
            data-place-uuid={placeId}
            aria-pressed={saved}
            aria-label={saved ? "Remove from Bucketlist" : "Add to Bucketlist"}
            data-tooltip={
              saved ? "Remove from Bucketlist" : "Add to Bucketlist"
            }
          >
            <span className="upd-action__icon">
              <Icon name="Bucket" size={14} />
            </span>
            <span className="upd-action__label">Bucketlist</span>
          </button>
        </>
      )}
      {!premium && (
        <a
          className="upd-action"
          href="/explorer-plus/?feature=bucketlist"
          aria-label="Add to Bucketlist"
        >
          <Icon name="Bucket" size={18} />
          <span>Bucketlist</span>
        </a>
      )}
      {placeId && (
        <button
          type="button"
          className="upd-action"
          data-add-itinerary={placeId}
        >
          <span className="upd-action__label">+ Add to Itinerary</span>
        </button>
      )}
      <button
        type="button"
        className="upd-action upd-action--share"
        aria-label="Copy link to this destination"
        data-tooltip={shared ? "Link copied" : "Share this destination"}
        onClick={async () => {
          try {
            if (navigator.share) {
              await navigator.share({
                title: document.title,
                url: location.href,
              });
              return;
            }
            await navigator.clipboard.writeText(location.href);
            setShared(true);
            setTimeout(() => setShared(false), 2500);
          } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError"))
              notify(
                "Sharing is unavailable. Copy the address from your browser.",
                true,
              );
          }
        }}
      >
        <span className="upd-action__icon">
          <Icon name="Share" size={18} />
        </span>
      </button>
      {shared && (
        <span className="upd-note" role="status">
          Link copied
        </span>
      )}
    </div>
  );
}

export type ReviewEdit = {
  id: string;
  rating: number;
  title: string;
  body: string;
  updatedAt: string;
};
export function ReviewForm({
  placeId,
  review,
  onSaved,
  onDirtyChange,
  onBusyChange,
  onCancel,
}: {
  placeId?: string;
  review?: ReviewEdit;
  onSaved?: (message: string) => void;
  onDirtyChange?: () => void;
  onBusyChange?: (busy: boolean) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <ValidatedForm
      className="upd-review-form"
      onChange={onDirtyChange}
      data-backend="true"
      onSubmit={async (event) => {
        event.preventDefault();
        if ((!placeId && !review) || busy || !rating) return;
        setBusy(true);
        onBusyChange?.(true);
        const values = new FormData(event.currentTarget);
        try {
          const response = await fetch(
            review ? `/api/v1/reviews/${review.id}/` : "/api/v1/reviews/",
            {
              method: review ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(review
                  ? { updated_at: review.updatedAt }
                  : { place_id: placeId }),
                rating,
                title: values.get("title"),
                body: values.get("body"),
              }),
            },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          const savedMessage =
            result.data.status === "pending"
              ? "Your review is awaiting approval."
              : review
                ? "Review updated."
                : "Review posted.";
          setMessage(savedMessage);
          onSaved?.(savedMessage);
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Please try again.",
          );
        } finally {
          setBusy(false);
          onBusyChange?.(false);
        }
      }}
    >
      <div
        className="upd-stars-input"
        role="group"
        aria-label="Preview your rating"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            className={`upd-star${n <= (hover || rating) ? " is-on" : ""}`}
            key={n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            disabled={busy}
            onClick={() => {
              setRating(n);
              onDirtyChange?.();
            }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
          >
            <Icon name="Star" size={30} />
          </button>
        ))}
      </div>
      <input
        className="upd-review-title"
        name="title"
        type="text"
        maxLength={80}
        placeholder="Title (optional)"
        aria-label="Review title"
        defaultValue={review?.title}
        disabled={busy}
      />
      <textarea
        className="upd-review-body resize-none"
        name="body"
        maxLength={10000}
        rows={4}
        placeholder="Share your experience..."
        aria-label="Your review"
        defaultValue={review?.body}
        disabled={busy}
      />
      <div className="upd-review-actions">
        <button
          type="submit"
          className="upd-btn upd-btn--primary"
          disabled={(!placeId && !review) || busy || !rating}
        >
          {busy ? "Saving…" : review ? "Save changes" : "Post review"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="p2-button p2-button--quiet"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
      <p
        className={placeId || review ? "upd-review-msg" : "phase1-pending"}
        role="status"
      >
        {message ||
          (!placeId && !review
            ? "Review posting is pending account and database integration."
            : "")}
      </p>
    </ValidatedForm>
  );
}
export function ReviewControls({
  id,
  initialLikes = 0,
  initialLiked = false,
}: {
  id: string;
  initialLikes?: number;
  initialLiked?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked),
    [count, setCount] = useState(initialLikes),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="upd-review-actions">
      <button
        className={`upd-like${liked ? " is-liked" : ""}`}
        type="button"
        aria-pressed={liked}
        aria-label={liked ? "Unlike review" : "Like review"}
        aria-busy={busy}
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            await requestJSON("/api/v1/review-likes/", "POST", {
              review_id: id,
              liked: !liked,
            });
            setLiked(!liked);
            setCount(count + (liked ? -1 : 1));
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="Heart" size={24} />
        {count ? <span>{count}</span> : null}
      </button>
      <span role="status">{message}</span>
    </div>
  );
}
