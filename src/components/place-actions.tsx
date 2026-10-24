"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useDecision } from "./ui/decision";
import { useState } from "react";
import { Icon } from "./icon";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/client-api";

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

export function ReviewForm({ placeId }: { placeId?: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <ValidatedForm
      className="upd-review-form"
      data-backend="true"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!placeId) return;
        setBusy(true);
        const values = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/v1/reviews/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              place_id: placeId,
              rating,
              title: values.get("title"),
              body: values.get("body"),
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          setMessage(
            result.data.status === "pending"
              ? "Your review is awaiting approval."
              : "Review posted.",
          );
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Please try again.",
          );
        } finally {
          setBusy(false);
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
            onClick={() => setRating(n)}
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
      />
      <textarea
        className="upd-review-body resize-none"
        name="body"
        maxLength={10000}
        rows={4}
        placeholder="Share your experience..."
        aria-label="Your review"
      />
      <div className="upd-review-actions">
        <button
          type="submit"
          className="upd-btn upd-btn--primary"
          disabled={!placeId || busy || !rating}
        >
          Post review
        </button>
      </div>
      <p
        className={placeId ? "upd-review-msg" : "phase1-pending"}
        role="status"
      >
        {message ||
          (!placeId
            ? "Review posting is pending account and database integration."
            : "")}
      </p>
    </ValidatedForm>
  );
}
export function ReviewControls({
  id,
  own,
  initialLikes = 0,
  initialLiked = false,
}: {
  id: string;
  own: boolean;
  initialLikes?: number;
  initialLiked?: boolean;
}) {
  const { ask, dialog } = useDecision();
  const [liked, setLiked] = useState(initialLiked),
    [count, setCount] = useState(initialLikes),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div className="upd-review-actions">
      {dialog}
      <button
        className={`upd-like${liked ? " is-liked" : ""}`}
        type="button"
        aria-pressed={liked}
        onClick={async () => {
          const r = await fetch("/api/v1/review-likes/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ review_id: id, liked: !liked }),
          });
          if (r.ok) {
            setLiked(!liked);
            setCount(count + (liked ? -1 : 1));
          } else setMessage((await r.json()).error);
        }}
      >
        Like{count ? ` (${count})` : ""}
      </button>
      {own && (
        <button
          type="button"
          className="upd-btn upd-btn--ghost"
          onClick={async () => {
            if (
              !(await ask(
                "Delete your review? You can write a new one afterwards.",
              ))
            )
              return;
            const r = await fetch(`/api/v1/reviews/${id}/`, {
              method: "DELETE",
            });
            if (r.ok) router.refresh();
            else setMessage((await r.json()).error);
          }}
        >
          Delete review
        </button>
      )}
      <span role="status">{message}</span>
    </div>
  );
}
