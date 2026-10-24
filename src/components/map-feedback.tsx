"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function MapFeedback({
  loading,
  error,
  retry,
  children,
  className = "p2-map-notice",
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const notice = ref.current;
    const host = notice?.parentElement;
    if (!notice || !host) return;
    const measure = () =>
      host.style.setProperty(
        "--p2-map-feedback-height",
        `${notice.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(notice);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--p2-map-feedback-height");
    };
  }, [loading, error]);
  if (!loading && !error) return null;
  return (
    <div ref={ref} className={`${className} p2-map-feedback`} role="status">
      <span>
        {error
          ? "The map couldn’t load. Destination choices are still available."
          : "Loading satellite map… You can browse destinations while it loads."}
      </span>
      {error && (
        <button
          type="button"
          className="p2-button p2-button--quiet"
          onClick={retry}
        >
          Retry map
        </button>
      )}
      {error && children}
    </div>
  );
}
