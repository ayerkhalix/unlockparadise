"use client";
import type { ReactNode } from "react";
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
  if (!loading && !error) return null;
  return (
    <div className={`${className} p2-map-feedback`} role="status">
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
