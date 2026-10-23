"use client";
import type { StudioNavigation } from "../admin-console";
import { ContentImage } from "../ui/content-image";
import {
  activityAction,
  activityRecord,
  date,
  list,
  str,
  useAdminData,
  type AdminData,
  type Row,
} from "./shared";
import { StudioIcon } from "./studio-icon";

type Props = {
  data: AdminData | null;
  content: boolean;
  administrator: boolean;
  orders: boolean;
  navigate: StudioNavigation;
  openEditor: (kind: "place" | "product", row: Row | null) => void;
};
function cover(row: Row) {
  return list(row.place_media).find((item) => item.kind === "cover")?.media_id;
}
export function StudioOverview({
  data,
  content,
  administrator,
  orders,
  navigate,
  openEditor,
}: Props) {
  const library = useAdminData(
    content ? "places?status=publish&offset=0" : null,
  );
  const selection = (library.data?.data || [])
    .filter((row) => cover(row) && !/^\[test\]/i.test(String(row.title)))
    .slice(0, 3);
  return (
    <div className="studio-collection-desk">
      {content && (
        <section
          className="studio-library-preview"
          aria-labelledby="studio-library-heading"
        >
          <div className="studio-section-heading">
            <div>
              <h2 id="studio-library-heading">The Place library</h2>
              <p>Published destinations and their cover photos.</p>
            </div>
            <a
              href="/admin/?section=places"
              onClick={(event) => {
                event.preventDefault();
                void navigate("places");
              }}
            >
              Open library <StudioIcon name="arrow" size={17} />
            </a>
          </div>
          <div className="studio-library-facts">
            <span>
              <i aria-hidden="true" />
              {str(data?.published)} published Places
            </span>
            <span>{str(data?.drafts)} drafts</span>
          </div>
          {library.loading ? (
            <div
              className="studio-contact-sheet studio-contact-sheet--loading"
              role="status"
            >
              <span>Loading your Place library…</span>
            </div>
          ) : library.error ? (
            <div className="studio-library-failed" role="alert">
              <p>The Place selection couldn’t be loaded.</p>
              <button onClick={library.reload}>
                Try Place selection again
              </button>
            </div>
          ) : selection.length ? (
            <div className="studio-contact-sheet">
              {selection.map((row, index) => (
                <button
                  className="studio-specimen"
                  key={str(row.id)}
                  onClick={() => openEditor("place", row)}
                >
                  <span className="studio-sr">Edit Place: </span>
                  <div className="studio-specimen-photo">
                    <ContentImage
                      src={`/api/media/${cover(row)}/`}
                      alt=""
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                    <span className="studio-specimen-open">
                      <StudioIcon name="arrow" size={20} />
                    </span>
                  </div>
                  <span className="studio-specimen-name">{str(row.title)}</span>
                  <span className="studio-specimen-meta">
                    {list(row.place_areas)
                      .map((item) => str((item.areas as Row)?.name))
                      .join(" · ") || "Area not assigned"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="studio-library-failed">
              <p>
                {library.data?.count
                  ? "Add cover photos to your Places to see them here."
                  : "Your Place library is ready for its first destination."}
              </p>
              <button onClick={() => openEditor("place", null)}>
                Add Place
              </button>
            </div>
          )}
          <div className="studio-library-caption">
            <StudioIcon name="book" size={16} />
            <span>
              From your published collection. Select a Place to edit its
              details.
            </span>
          </div>
        </section>
      )}
      {!content && orders && (
        <section
          className="studio-order-summary"
          aria-labelledby="studio-order-heading"
        >
          <StudioIcon name="orders" size={36} />
          <h2 id="studio-order-heading">Orders &amp; fulfillment</h2>
          <p>Recorded orders and confirmed payments, ready to review.</p>
          <dl>
            <div>
              <dt>Paid orders</dt>
              <dd>{str(data?.paid_orders)}</dd>
            </div>
            <div>
              <dt>Pending orders</dt>
              <dd>{str(data?.pending_orders)}</dd>
            </div>
          </dl>
          <button className="admin-primary" onClick={() => navigate("orders")}>
            View Orders <StudioIcon name="arrow" size={18} />
          </button>
        </section>
      )}
      <aside
        className="studio-desk-aside"
        aria-label="Publishing and operations"
      >
        <section
          className="studio-review-ledger"
          aria-labelledby="studio-review-heading"
        >
          <h2 id="studio-review-heading">On your desk</h2>
          <p>
            {content
              ? "Drafts and reviews awaiting attention."
              : "Recorded orders awaiting review."}
          </p>
          {content && (
            <>
              <button onClick={() => navigate("places", { status: "draft" })}>
                <span className="studio-ledger-icon">
                  <StudioIcon name="book" />
                </span>
                <span>
                  <strong>Draft Places</strong>
                  <small>Continue editing</small>
                </span>
                <span className="studio-ledger-count">{str(data?.drafts)}</span>
                <StudioIcon name="arrow" size={17} />
              </button>
              <button
                onClick={() => navigate("reviews", { status: "pending" })}
              >
                <span className="studio-ledger-icon">
                  <StudioIcon name="reviews" />
                </span>
                <span>
                  <strong>Review submissions</strong>
                  <small>Awaiting moderation</small>
                </span>
                <span className="studio-ledger-count">
                  {str(data?.pending_reviews)}
                </span>
                <StudioIcon name="arrow" size={17} />
              </button>
            </>
          )}
          {orders && (
            <button onClick={() => navigate("orders")}>
              <span className="studio-ledger-icon">
                <StudioIcon name="orders" />
              </span>
              <span>
                <strong>Orders &amp; Sales</strong>
                <small>Payments &amp; fulfillment</small>
              </span>
              <StudioIcon name="arrow" size={17} />
            </button>
          )}
          {administrator && (
            <button onClick={() => navigate("members")}>
              <span className="studio-ledger-icon">
                <StudioIcon name="members" />
              </span>
              <span>
                <strong>Explorer+ members</strong>
                <small>Active membership access</small>
              </span>
              <span className="studio-ledger-count">
                {str(data?.active_memberships)}
              </span>
              <StudioIcon name="arrow" size={17} />
            </button>
          )}
        </section>
        {(content || administrator) && (
          <section
            className="studio-create-menu"
            aria-labelledby="studio-create-heading"
          >
            <h2 id="studio-create-heading">Create</h2>
            {content && (
              <button onClick={() => openEditor("place", null)}>
                <StudioIcon name="plus" size={18} />
                <span>Add Place</span>
                <StudioIcon name="arrow" size={17} />
              </button>
            )}
            {administrator && (
              <button onClick={() => openEditor("product", null)}>
                <StudioIcon name="plus" size={18} />
                <span>Add product</span>
                <StudioIcon name="arrow" size={17} />
              </button>
            )}
          </section>
        )}
        <p className="studio-commerce-note">
          <StudioIcon name="orders" size={18} />
          <span>
            Merchandise checkout is closed. Cart additions are never counted as
            sales.
          </span>
        </p>
      </aside>
      <section
        className="studio-journal"
        aria-labelledby="studio-journal-heading"
      >
        <div className="studio-section-heading">
          <h2 id="studio-journal-heading">Recent activity</h2>
          {administrator && (
            <a
              href="/admin/?section=settings&view=activity"
              onClick={(event) => {
                event.preventDefault();
                void navigate("settings", { view: "activity" });
              }}
            >
              Activity log <StudioIcon name="arrow" size={17} />
            </a>
          )}
        </div>
        {data ? (
          list(data.recent).length ? (
            <ol className="studio-journal-list">
              {list(data.recent)
                .slice(0, 5)
                .map((row, index) => (
                  <li key={str(row.id || index)}>
                    <span className="studio-journal-symbol">
                      <StudioIcon
                        name={
                          row.table_name === "places"
                            ? "places"
                            : row.table_name === "merch_products" ||
                                row.table_name === "merch_variants"
                              ? "merchandise"
                              : "book"
                        }
                        size={17}
                      />
                    </span>
                    <div>
                      <span className="studio-journal-title">
                        {str(row.label || row.record_id)}
                      </span>
                      <span className="studio-journal-action">
                        {activityAction(row.action)} ·{" "}
                        {activityRecord(row.table_name)}
                      </span>
                    </div>
                    <time dateTime={row.at ? String(row.at) : undefined}>
                      {date(row.at)}
                    </time>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="studio-journal-empty">No recent changes to show.</p>
          )
        ) : (
          <p className="studio-journal-empty">
            Activity will appear here when records load.
          </p>
        )}
      </section>
    </div>
  );
}
