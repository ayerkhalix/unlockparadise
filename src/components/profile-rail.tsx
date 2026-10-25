"use client";
import { useEffect, useRef, useState } from "react";

export function ProfileRail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ start: true, end: false });
  useEffect(() => {
    const rail = ref.current!;
    const update = () =>
      setPosition({
        start: rail.scrollLeft < 2,
        end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    rail.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", update);
    };
  }, []);
  const advance = (direction: number) => {
    const rail = ref.current!;
    rail.scrollBy({
      left: direction * rail.clientWidth,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <>
      <div
        ref={ref}
        className="profile-swipe"
        role="region"
        aria-label={`${label} destinations`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            !["ArrowLeft", "ArrowRight"].includes(event.key)
          )
            return;
          event.preventDefault();
          advance(event.key === "ArrowLeft" ? -1 : 1);
        }}
      >
        {children}
      </div>
      <div className="profile-swipe-controls">
        <span>Swipe to explore</span>
        <button
          type="button"
          className="p2-icon"
          aria-label={`Previous ${label} destinations`}
          disabled={position.start}
          onClick={() => advance(-1)}
        >
          ←
        </button>
        <button
          type="button"
          className="p2-icon"
          aria-label={`Next ${label} destinations`}
          disabled={position.end}
          onClick={() => advance(1)}
        >
          →
        </button>
      </div>
    </>
  );
}
