export function DestinationSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" className="p2-destination-loading">
      <span className="p2-sr-only">Loading destinations…</span>
      <div className="p2-loading-count" aria-hidden="true" />
      <div className="upd-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="upd-card p2-card-skeleton" key={index}>
            <div className="upd-card__photo" />
            <div className="upd-card__body">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
