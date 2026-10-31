"use client";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { ContentImage } from "./ui/content-image";

/** Native swipe scrolling, with only the current and neighboring photos loaded. */
export function DestinationCardPhotos({
  images,
  title,
  eager,
}: {
  images: string[];
  title: string;
  eager: boolean;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="destination-card-photos">
      <div
        className="destination-card-photos__track"
        onScroll={(event) => {
          const track = event.currentTarget;
          setActive(
            Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)),
          );
        }}
      >
        {images.map((src, index) => (
          <div
            className="destination-card-photos__frame"
            key={`${src}:${index}`}
          >
            {Math.abs(index - active) <= 1 && (
              <ContentImage
                src={src}
                alt={`${title}, photo ${index + 1}`}
                loading={eager && index === 0 ? "eager" : "lazy"}
                sizes="(max-width: 600px) 92vw, (max-width: 900px) 46vw, 400px"
              />
            )}
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <span className="destination-card-photos__count" aria-live="polite">
          {active + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
export function scrollDestinationPhoto(
  event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLAnchorElement>,
  direction: number,
) {
  const track = event.currentTarget
    .closest(".planner-destination-card")
    ?.querySelector<HTMLElement>(".destination-card-photos__track");
  if (!track) return;
  event.preventDefault();
  track.scrollBy({
    left: direction * track.clientWidth,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
