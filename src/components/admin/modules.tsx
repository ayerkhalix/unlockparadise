"use client";
import { useState, useEffect } from "react";
import type { useSearchParams } from "next/navigation";
import type { StudioNavigation } from "../admin-console";
import { useDecision } from "../ui/decision";
import { MediaUpload, TaxonomyManager } from "../admin-tools";
import {
  MemberTools,
  OrderDetails,
  ReviewDetails,
  SettingsTools,
  activeMember,
} from "./operations";
import { AnalyticsPanel, SalesPanel } from "./reports";
import {
  adminRequest,
  date,
  Filters,
  list,
  LoadState,
  Pagination,
  Stats,
  Status,
  str,
  StudioTable,
  useAdminData,
  type Row,
  type Column,
} from "./shared";
import { php } from "@/lib/commerce";
import { notify } from "@/lib/client-api";
import { TravelerDiscoveryPanel } from "./traveler-discovery";
type Props = {
  section: string;
  administrator: boolean;
  content: boolean;
  orders: boolean;
  params: ReturnType<typeof useSearchParams>;
  update: (v: Record<string, string>, replace?: boolean) => void;
  navigate: StudioNavigation;
  openEditor: (kind: "place" | "product", row: Row | null) => void;
};
export function StudioModule({
  section,
  administrator,
  content,
  orders,
  params,
  update,
  navigate,
  openEditor,
}: Props) {
  const { ask, dialog } = useDecision();
  const [detail, setDetail] = useState<Row | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const view = params.get("view") || "site",
    page = Math.max(1, Math.min(4000, Number(params.get("page")) || 1));
  const query = new URLSearchParams();
  for (const key of [
    "search",
    "status",
    "area",
    "category",
    "collection",
    "access",
    "sort",
    "payment",
    "fulfillment",
    "from",
    "to",
    "metric",
  ]) {
    const v = params.get(key);
    if (v) query.set(key, v);
  }
  query.set("offset", String((page - 1) * 25));
  const resource =
    section === "overview"
      ? content
        ? "metrics"
        : "sales"
      : section === "members"
        ? "users"
        : section === "settings"
          ? (
              {
                site: "settings",
                activity: "activity",
                media: "media",
                integrations: "integrations",
                contacts: "contacts",
                payments: "payments",
              } as Record<string, string>
            )[view] || "settings"
          : section === "places" && view === "media"
            ? "media"
            : section;
  const state = useAdminData(`${resource}?${query}`),
    taxonomy = useAdminData(section === "places" ? "taxonomy" : null),
    catalog = useAdminData(
      section === "merchandise" ? "catalog-options" : null,
    );
  const rows = state.data?.data || [],
    count = Number(state.data?.count || 0),
    data = state.data;
  useEffect(() => {
    const max = Math.max(1, Math.ceil(count / 25));
    if (data && page > max) update({ page: String(max) }, true);
  }, [count, data, page, update]);
  const filter = (key: string, value: string) =>
    update({ [key]: value }, key === "search");
  const select = (key: string, label: string, options: [string, string][]) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={params.get(key) || ""}
        onChange={(e) => filter(key, e.target.value)}
      >
        <option value="">
          All {key === "collection" ? "collections" : label.toLowerCase()}
        </option>
        {options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  async function run(path: string, method: string, body?: unknown) {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      await adminRequest(path, method, body);
      notify("Changes saved.");
      state.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setWorking(false);
    }
  }
  async function openDetail(row: Row) {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const latest = await adminRequest(`${resource}/${row.id}`);
      if (!latest.data?.[0])
        throw new Error("This record is no longer available.");
      setDetail(latest.data[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open record.");
    } finally {
      setWorking(false);
    }
  }
  const placeColumns: Column[] = [
    {
      label: "Place",
      render: (r) => {
        const cover = list(r.place_media).find((m) => m.kind === "cover");
        return (
          <div className="studio-place-cell">
            {cover && (
              <img
                src={`/api/media/${cover.media_id}/`}
                alt=""
                loading="lazy"
              />
            )}
            <div>
              <strong>{str(r.title)}</strong>
              <small>{str(r.slug)}</small>
            </div>
          </div>
        );
      },
    },
    {
      label: "Area / category",
      render: (r) => (
        <>
          {list(r.place_areas)
            .map((a) => str((a.areas as Row)?.name))
            .join(", ") || "Not assigned"}
          <small>
            {list(r.place_categories)
              .map((c) => str((c.categories as Row)?.name))
              .join(", ") || "Not assigned"}
          </small>
        </>
      ),
    },
    { label: "Status", render: (r) => <Status value={r.status} /> },
    {
      label: "Access",
      render: (r) => (r.vip_content ? "Explorer+" : "Standard"),
    },
    { label: "Updated", render: (r) => date(r.updated_at) },
    {
      label: "Actions",
      render: (r) => (
        <div className="admin-actions">
          <button disabled={working} onClick={() => openEditor("place", r)}>
            Edit<span className="studio-sr"> {str(r.title)}</span>
          </button>
          <a href={`/admin/preview/${r.id}/`} target="_blank" rel="noreferrer">
            Preview
          </a>
          {administrator && r.status === "archived" && (
            <button
              onClick={async () => {
                const slug = await ask(
                  `Delete ${str(r.title)} permanently? Referenced Places must stay archived. Type its exact slug:`,
                  "",
                );
                if (slug)
                  void run(`places/${r.id}`, "DELETE", { confirm_slug: slug });
              }}
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];
  const productColumns: Column[] = [
    {
      label: "Product",
      render: (r) => (
        <div className="studio-place-cell">
          <img src={String(list(r.images)[0]?.src)} alt="" loading="lazy" />
          <div>
            <strong>{str(r.name)}</strong>
            <small>{str(r.sku)}</small>
          </div>
        </div>
      ),
    },
    { label: "Price", render: (r) => php(Number(r.price_centavos)) },
    {
      label: "Inventory",
      render: (r) => {
        const v = list(r.merch_variants).filter((v) => v.active);
        return v.some((v) => v.stock === null)
          ? "Not fully counted"
          : `${v.reduce((s, v) => s + Number(v.stock), 0)} in stock`;
      },
    },
    { label: "Category", render: (r) => str(r.category) },
    { label: "Status", render: (r) => <Status value={r.status} /> },
    { label: "Updated", render: (r) => date(r.updated_at) },
    {
      label: "Actions",
      render: (r) => (
        <div className="admin-actions">
          <button onClick={() => openEditor("product", r)}>
            Edit<span className="studio-sr"> {str(r.name)}</span>
          </button>
          <button
            disabled={working}
            onClick={() => run(`merchandise/${r.id}/duplicate`, "POST")}
          >
            Duplicate
          </button>
          {r.status === "publish" && (
            <a
              href={`/merch/products/${r.slug}/`}
              target="_blank"
              rel="noreferrer"
            >
              View
            </a>
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      {dialog}
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      {section === "overview" && (
        <>
          <Stats
            items={
              content
                ? [
                    ["Published Places", str(data?.published)],
                    ["Draft Places", str(data?.drafts)],
                    ["Pending reviews", str(data?.pending_reviews)],
                    ...(administrator
                      ? [
                          [
                            "Active Explorer+",
                            str(data?.active_memberships),
                          ] as [string, string],
                        ]
                      : []),
                  ]
                : [
                    ["Paid orders", str(data?.paid_orders)],
                    ["Pending orders", str(data?.pending_orders)],
                  ]
            }
          />
          <div className="studio-overview-grid">
            <section>
              <h2>Studio shortcuts</h2>
              <div className="studio-quick-actions">
                {content && (
                  <button
                    className="admin-primary"
                    onClick={() => openEditor("place", null)}
                  >
                    Add Place
                  </button>
                )}
                {administrator && (
                  <>
                    <button onClick={() => openEditor("product", null)}>
                      Add product
                    </button>
                    <button onClick={() => navigate("places")}>
                      Manage Places
                    </button>
                  </>
                )}
                {content && (
                  <button
                    onClick={() => navigate("reviews", { status: "pending" })}
                  >
                    Review submissions
                  </button>
                )}
                {orders && (
                  <button onClick={() => navigate("orders")}>
                    View Orders
                  </button>
                )}
              </div>
            </section>
            <section>
              <h2>Ready for your attention</h2>
              <div className="studio-action-list">
                {content && (
                  <>
                    <button
                      onClick={() => navigate("places", { status: "draft" })}
                    >
                      <span>
                        Draft Places
                        <small>Check details and publish when ready.</small>
                      </span>
                      <strong>{str(data?.drafts)}</strong>
                    </button>
                    <button
                      onClick={() => navigate("reviews", { status: "pending" })}
                    >
                      <span>
                        Reviews awaiting moderation
                        <small>
                          Read submissions before they appear publicly.
                        </small>
                      </span>
                      <strong>{str(data?.pending_reviews)}</strong>
                    </button>
                  </>
                )}
                {orders && (
                  <button onClick={() => navigate("orders")}>
                    <span>
                      Orders & Sales
                      <small>Review recorded payments and fulfillment.</small>
                    </span>
                    <span>Open</span>
                  </button>
                )}
              </div>
              <p className="studio-note">
                Merchandise checkout is closed. Bag additions are never counted
                as sales.
              </p>
            </section>
          </div>
          <h2>Recent activity</h2>
          <StudioTable
            caption="Recent studio activity"
            rows={list(data?.recent).slice(0, 5)}
            empty="No recent changes to show."
            columns={[
              { label: "When", render: (r) => date(r.at) },
              {
                label: "Action",
                render: (r) => str(r.action).toLowerCase().replaceAll("_", " "),
              },
              {
                label: "Record",
                render: (r) => str(r.table_name).replaceAll("_", " "),
              },
              {
                label: "Item",
                render: (r) => <span>{str(r.label || r.record_id)}</span>,
              },
            ]}
          />
        </>
      )}
      {section === "places" && (
        <>
          <div className="studio-subnav">
            <button
              aria-pressed={view !== "media"}
              onClick={() => update({ view: "", page: "" })}
            >
              Place library
            </button>
            <button
              aria-pressed={view === "media"}
              onClick={() => update({ view: "media", search: "", page: "" })}
            >
              Media library
            </button>
          </div>
          {view !== "media" && (
            <>
              <Filters
                search={params.get("search") || ""}
                onSearch={(s) => filter("search", s)}
                label="Search Places"
              >
                {select(
                  "area",
                  "Areas",
                  list(taxonomy.data?.areas).map((r) => [
                    str(r.id),
                    str(r.name),
                  ]),
                )}
                {select(
                  "category",
                  "Categories",
                  list(taxonomy.data?.categories).map((r) => [
                    str(r.id),
                    str(r.name),
                  ]),
                )}
                {select("status", "Statuses", [
                  ["draft", "Draft"],
                  ["publish", "Published"],
                  ["archived", "Archived"],
                ])}
                {select("access", "Access levels", [
                  ["standard", "Standard"],
                  ["vip", "Explorer+"],
                ])}
                <label>
                  Sort
                  <select
                    value={params.get("sort") || "updated"}
                    onChange={(e) => filter("sort", e.target.value)}
                  >
                    <option value="updated">Recently updated</option>
                    <option value="title">Place name</option>
                  </select>
                </label>
              </Filters>
              <StudioTable
                caption="Place library"
                rows={rows}
                columns={placeColumns}
                empty="No matching Places. Clear the filters or add a Place."
              />
              <TaxonomyManager />
            </>
          )}
        </>
      )}
      {section === "merchandise" && (
        <>
          <Filters
            search={params.get("search") || ""}
            onSearch={(s) => filter("search", s)}
            label="Search products or SKU"
          >
            {select("status", "Statuses", [
              ["draft", "Draft"],
              ["publish", "Published"],
              ["archived", "Archived"],
            ])}
            {select(
              "collection",
              "Collection",
              list(catalog.data?.collections).map((r) => [
                str(r.id),
                str(r.name),
              ]),
            )}
            <label>
              Category
              <input
                value={params.get("category") || ""}
                onChange={(e) => filter("category", e.target.value)}
                placeholder="All categories"
              />
            </label>
            <label>
              Sort
              <select
                value={params.get("sort") || "updated"}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="updated">Recently updated</option>
                <option value="name">Product name</option>
              </select>
            </label>
          </Filters>
          {catalog.loading ? (
            <p role="status">Loading collections…</p>
          ) : (
            catalog.error && (
              <div className="studio-error" role="alert">
                <p>{catalog.error}</p>
                <button type="button" onClick={catalog.reload}>
                  Retry collections
                </button>
              </div>
            )
          )}
          <StudioTable
            caption="Merchandise catalog"
            rows={rows}
            columns={productColumns}
            empty="No matching products. Add a product or clear the filters."
          />
        </>
      )}
      {section === "orders" && (
        <SalesPanel
          rows={rows}
          query={query.toString()}
          params={params}
          update={update}
          select={select}
          onDetails={openDetail}
        />
      )}
      {section === "analytics" && (
        <>
          <AnalyticsPanel data={data} params={params} update={update} />
          {administrator && <TravelerDiscoveryPanel />}
        </>
      )}
      {section === "members" && (
        <>
          <Filters
            label="Search members by name"
            search={params.get("search") || ""}
            onSearch={(s) => filter("search", s)}
          />
          <StudioTable
            caption="Members"
            rows={rows}
            empty="No matching members."
            columns={[
              {
                label: "Member",
                render: (r) => (
                  <>
                    <strong>{str(r.display_name)}</strong>
                    <small>Joined {date(r.created_at)}</small>
                  </>
                ),
              },
              {
                label: "Membership",
                render: (r) => (activeMember(r) ? "Explorer+" : "Explorer"),
              },
              {
                label: "Studio access",
                render: (r) =>
                  str((r.user_roles as Row)?.role || "Member").replace(
                    "admin",
                    "Owner",
                  ),
              },
              {
                label: "Actions",
                render: (r) => (
                  <button disabled={working} onClick={() => openDetail(r)}>
                    Manage
                    <span className="studio-sr"> {str(r.display_name)}</span>
                  </button>
                ),
              },
            ]}
          />
        </>
      )}
      {section === "reviews" && (
        <>
          <Filters
            label="Search review text"
            search={params.get("search") || ""}
            onSearch={(s) => filter("search", s)}
          >
            {select("status", "Statuses", [
              ["pending", "Pending"],
              ["approved", "Published"],
              ["rejected", "Hidden / rejected"],
            ])}
          </Filters>
          <StudioTable
            caption="Review moderation"
            rows={rows}
            empty="No matching reviews. New submissions will appear here."
            columns={[
              {
                label: "Review",
                render: (r) => (
                  <>
                    <strong>{str(r.title || "Untitled review")}</strong>
                    <small>{str(r.body).slice(0, 130)}</small>
                  </>
                ),
              },
              {
                label: "Place / author",
                render: (r) => (
                  <>
                    {str((r.places as Row)?.title)}
                    <small>{str(r.author_name)}</small>
                  </>
                ),
              },
              { label: "Rating", render: (r) => `${r.rating} / 5` },
              { label: "Status", render: (r) => <Status value={r.status} /> },
              { label: "Submitted", render: (r) => date(r.created_at) },
              {
                label: "Actions",
                render: (r) => (
                  <button disabled={working} onClick={() => openDetail(r)}>
                    Review
                    <span className="studio-sr"> by {str(r.author_name)}</span>
                  </button>
                ),
              },
            ]}
          />
        </>
      )}
      {section === "settings" && (
        <>
          <div className="studio-subnav">
            {[
              ["site", "Site & security"],
              ["activity", "Activity log"],
              ["media", "Media"],
              ["integrations", "Integrations"],
              ["contacts", "Inbox"],
              ["payments", "Membership payments"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={view === id}
                onClick={() => update({ view: id, search: "", page: "" })}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "activity" && (
            <Filters
              label="Search activity by entity"
              search={params.get("search") || ""}
              onSearch={(s) => filter("search", s)}
            />
          )}
          <SettingsTools
            view={view}
            data={data}
            rows={rows}
            run={run}
            working={working}
          />
        </>
      )}
      {((section === "places" && view === "media") ||
        (section === "settings" && view === "media")) && (
        <>
          <MediaUpload onSaved={state.reload} />
          <StudioTable
            caption="Media library"
            rows={rows}
            columns={[
              {
                label: "Image",
                render: (r) => (
                  <div className="studio-place-cell">
                    {r.status === "ready" && (
                      <img
                        src={`/api/media/${r.id}/`}
                        alt={String(r.alt || "")}
                        loading="lazy"
                      />
                    )}
                    <span>{str(r.alt || r.legacy_id || "Untitled image")}</span>
                  </div>
                ),
              },
              {
                label: "Visibility",
                render: (r) =>
                  r.bucket === "destination-public" ? "Public" : "Private",
              },
              { label: "Status", render: (r) => <Status value={r.status} /> },
              {
                label: "Actions",
                render: (r) => (
                  <div className="admin-actions">
                    <button
                      onClick={async () => {
                        const alt = await ask(
                          "Alternative text",
                          String(r.alt || ""),
                        );
                        if (alt !== null)
                          void run(`media/${r.id}`, "PATCH", { alt });
                      }}
                    >
                      Edit alt text
                    </button>
                    {r.status !== "ready" ? (
                      <button
                        onClick={() =>
                          run(`media/${r.id}`, "PATCH", { status: "ready" })
                        }
                      >
                        Approve
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          if (
                            await ask(
                              "Revoke this image? Its associations remain, but the image will be unavailable.",
                            )
                          )
                            void run(`media/${r.id}`, "PATCH", {
                              status: "rejected",
                            });
                        }}
                      >
                        Revoke
                      </button>
                    )}
                    {administrator && r.status === "rejected" && (
                      <button
                        onClick={async () => {
                          if (
                            await ask(
                              "Delete this unreferenced image and its storage copies?",
                            )
                          )
                            void run(`media/${r.id}`, "DELETE", {
                              confirm_id: r.id,
                            });
                        }}
                      >
                        Delete unreferenced image
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
      <LoadState
        loading={state.loading}
        error={state.error}
        retry={state.reload}
      />
      <div className="studio-pagination">
        <button disabled={state.loading} onClick={state.reload}>
          Refresh
        </button>
      </div>
      {!["overview", "analytics"].includes(section) &&
        resource !== "integrations" && (
          <Pagination
            count={count}
            page={page}
            busy={state.loading}
            onPage={(p) => update({ page: String(p) })}
          />
        )}
      {detail && section === "orders" && (
        <OrderDetails
          row={detail}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            state.reload();
          }}
        />
      )}
      {detail && section === "reviews" && (
        <ReviewDetails
          row={detail}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            state.reload();
          }}
        />
      )}
      {detail && section === "members" && (
        <MemberTools
          row={detail}
          onClose={() => setDetail(null)}
          onSaved={() => {
            setDetail(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}
