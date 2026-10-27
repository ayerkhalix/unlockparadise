"use client";
import { useEffect, useState } from "react";
import type { ItinerarySummary } from "@/lib/itinerary-library";
import { tripDateLabel } from "@/lib/planning";
import { useAmbientMotion } from "@/lib/use-ambient-motion";
import { ContentImage } from "./ui/content-image";

export function ItineraryLibraryCard({
  trip,
  href,
  eager,
}: {
  trip: ItinerarySummary;
  href: string;
  eager: boolean;
}) {
  const ref = useAmbientMotion<HTMLLIElement>();
  const sources = trip.images?.length
    ? trip.images
    : trip.image
      ? [trip.image]
      : [];
  const [failed, setFailed] = useState<string[]>([]);
  const images = [...new Set(sources)].filter((src) => !failed.includes(src));
  const [current, setCurrent] = useState(images[0]);
  const [previous, setPrevious] = useState<string | null>(null);
  const shown = images.includes(current) ? current : images[0];
  const next =
    images.length > 1
      ? images[(images.indexOf(shown) + 1) % images.length]
      : undefined;

  useEffect(() => {
    if (!next) return;
    const timer = setInterval(() => {
      const card = ref.current;
      if (
        card?.dataset.playing !== "true" ||
        card.closest("[inert]") ||
        card.querySelector("a:focus-visible")
      )
        return;
      const frame = card.querySelector("[data-next-photo='true']");
      if (frame?.querySelector(".p2-photo-fallback")) {
        setFailed((old) => [...old, next]);
        return;
      }
      const photo = frame?.querySelector("img");
      if (!photo?.complete || !photo.naturalWidth) return;
      if (card.querySelector("[data-current-photo='true'] .p2-photo-fallback"))
        setFailed((old) => [...old, shown]);
      setPrevious(shown);
      setCurrent(next);
    }, 2000);
    return () => clearInterval(timer);
  }, [shown, next, ref]);
  useEffect(() => {
    if (!previous) return;
    const timer = setTimeout(() => setPrevious(null), 550);
    return () => clearTimeout(timer);
  }, [previous]);
  const frames = [
    ...new Set(
      [previous, shown, next].filter((src): src is string => Boolean(src)),
    ),
  ];
  return (
    <li
      ref={ref}
      className="itinerary-library-card"
      data-photo-count={images.length}
    >
      <a
        className="itinerary-library-card__link"
        data-itinerary-card
        href={href}
      >
        <div
          className={`itinerary-library-card__photo${previous ? " is-crossfading" : ""}`}
        >
          {shown ? (
            frames.map((src) => (
              <div
                key={src}
                className={`itinerary-card-photo__frame${src === shown ? " is-current" : src === previous ? " is-previous" : ""}`}
                data-current-photo={src === shown}
                data-next-photo={src === next && src !== shown}
                aria-hidden="true"
              >
                <ContentImage
                  src={src}
                  alt=""
                  sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 46vw, 30vw"
                  loading={eager && src === shown ? "eager" : "lazy"}
                />
              </div>
            ))
          ) : (
            <span>
              {trip.stop_count ? "Photos unavailable" : "No destinations yet"}
            </span>
          )}
        </div>
        <div className="itinerary-library-card__body">
          <p className="itinerary-library-card__area">{trip.area}</p>
          <h2>{trip.title}</h2>
          <p className="itinerary-library-card__dates">
            {tripDateLabel(trip.start_date, trip.end_date)}
          </p>
          <p className="itinerary-library-card__counts">
            {trip.day_count} {trip.day_count === 1 ? "day" : "days"}
            <span aria-hidden="true"> · </span>
            {trip.stop_count}{" "}
            {trip.stop_count === 1 ? "destination" : "destinations"}
          </p>
          <span className="itinerary-library-card__open">
            Open itinerary <span aria-hidden="true">↗</span>
          </span>
        </div>
      </a>
    </li>
  );
}
