"use client";
import { lazy, Suspense } from "react";
import type { useSearchParams } from "next/navigation";
import {
  date,
  list,
  Stats,
  str,
  StudioTable,
  Status,
  useAdminData,
  Filters,
  LoadState,
  type Row,
  type AdminData,
} from "./shared";
import { php, averageCentavos } from "@/lib/commerce";
const Trend = lazy(() => import("./trend"));
type PeriodProps = {
  params: ReturnType<typeof useSearchParams>;
  update: (v: Record<string, string>) => void;
};
function DateRange({ params, update }: PeriodProps) {
  return (
    <div className="studio-filters">
      <label>
        From
        <input
          type="date"
          value={params.get("from") || ""}
          onChange={(e) => update({ from: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={params.get("to") || ""}
          onChange={(e) => update({ to: e.target.value })}
        />
      </label>
      <p>Last 30 days by default · inclusive dates · up to 93 days</p>
    </div>
  );
}
export function SalesPanel({
  rows,
  query,
  params,
  update,
  select,
  onDetails,
}: {
  rows: Row[];
  query: string;
  select: (
    key: string,
    label: string,
    options: [string, string][],
  ) => React.ReactNode;
  onDetails: (row: Row) => void;
} & PeriodProps) {
  const sales = useAdminData(`sales?${query}`);
  const s = sales.data;
  return (
    <>
      <DateRange params={params} update={update} />
      <Stats
        items={[
          [
            "Confirmed net merchandise sales",
            s ? php(Number(s.net_centavos)) : "—",
          ],
          ["Paid orders", str(s?.paid_orders)],
          ["Pending · all time", str(s?.pending_orders)],
          ["Refunded / partly refunded", str(s?.refunded_orders)],
          [
            "Net average per paid order",
            s
              ? php(
                  Number(s.paid_orders)
                    ? averageCentavos(
                        Number(s.net_centavos),
                        Number(s.paid_orders),
                      )
                    : 0,
                )
              : "—",
          ],
        ]}
      />
      {s?.membership_paid_centavos !== null && s && (
        <p>
          Explorer+ membership receipts:{" "}
          <strong>{php(Number(s.membership_paid_centavos || 0))}</strong> ·
          fully paid sandbox transactions in this period, separate from
          merchandise.
        </p>
      )}
      <p className="studio-note">
        Sandbox records only. Confirmed merchandise sales deduct verified
        refunds. No admin action can confirm a payment.
      </p>
      <Filters
        label="Search exact order ID"
        search={params.get("search") || ""}
        onSearch={(search) => update({ search })}
      >
        {select(
          "payment",
          "Payment states",
          [
            "pending",
            "paid",
            "partially_refunded",
            "refunded",
            "failed",
            "expired",
          ].map((s) => [s, s.replaceAll("_", " ")]),
        )}
        {select(
          "fulfillment",
          "Fulfillment states",
          [
            "unfulfilled",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
          ].map((s) => [s, s]),
        )}
      </Filters>
      <a
        className="studio-export"
        href={`/api/admin/orders/?${query}&format=csv`}
        download
      >
        Export matching orders CSV (up to 1,000)
      </a>
      <StudioTable
        caption="Orders"
        rows={rows}
        empty="No orders yet. Orders will appear here after checkout is activated and real orders are recorded."
        columns={[
          {
            label: "Order",
            render: (r) => (
              <button onClick={() => onDetails(r)}>
                {str(r.id).slice(0, 8)}
                <span className="studio-sr"> View order {str(r.id)}</span>
              </button>
            ),
          },
          { label: "Date", render: (r) => date(r.created_at) },
          {
            label: "Payment",
            render: (r) => <Status value={r.payment_status} />,
          },
          {
            label: "Fulfillment",
            render: (r) => <Status value={r.fulfillment_status} />,
          },
          { label: "Total", render: (r) => php(Number(r.total_centavos)) },
        ]}
      />
      {list(s?.best_sellers).length > 0 && (
        <>
          <h2>Best sellers · fully paid orders</h2>
          <StudioTable
            caption="Best selling merchandise"
            rows={list(s?.best_sellers)}
            columns={[
              { label: "Product", render: (r) => str(r.product_name) },
              { label: "Units", render: (r) => str(r.units) },
            ]}
          />
        </>
      )}
      <LoadState
        loading={sales.loading}
        error={sales.error}
        retry={sales.reload}
      />
    </>
  );
}
export function AnalyticsPanel({
  data,
  params,
  update,
}: { data: AdminData | null } & PeriodProps) {
  return (
    <>
      <DateRange params={params} update={update} />
      <p className="studio-note">
        Opt-in first-party events · Asia/Manila. A view counts once per
        anonymous session, Place/product and day. Sessions are not unique
        people. Automated browser activity is excluded.
      </p>
      {data && (
        <p>
          Period: {str(data.first_day)} to {str(data.last_day)} ·{" "}
          {data.began_at
            ? `Measurement began ${date(data.began_at)}.`
            : "Measurement has just begun."}
        </p>
      )}
      <Stats
        items={[
          ["Measured events", str(data?.events)],
          ["Anonymous sessions", str(data?.sessions)],
          [
            "Place views",
            data ? str((data.totals as Row)?.place_viewed || 0) : "—",
          ],
          [
            "Product views",
            data ? str((data.totals as Row)?.product_viewed || 0) : "—",
          ],
        ]}
      />
      {data && Number(data.events) === 0 ? (
        <div className="studio-empty">
          <h2>Measurement starts here.</h2>
          <p>
            No consented activity in this period. Historical traffic has not
            been invented.
          </p>
        </div>
      ) : (
        data && (
          <Suspense fallback={<p role="status">Loading activity trend…</p>}>
            <Trend rows={list(data.trend)} />
          </Suspense>
        )
      )}
      <h2>
        {params.get("metric") === "saves"
          ? "Most saved Places · measured events"
          : params.get("metric") === "planned"
            ? "Most planned Places · measured additions"
            : "Most explored Places"}
      </h2>
      <label className="studio-setting">
        Rank Places by
        <select
          aria-label="Rank Places by"
          value={params.get("metric") || "views"}
          onChange={(e) => update({ metric: e.target.value })}
        >
          <option value="views">Place views</option>
          <option value="saves">Bucketlist save events</option>
          <option value="planned">Itinerary additions</option>
        </select>
      </label>
      <StudioTable
        caption="Measured Place interest"
        rows={list(data?.places)}
        columns={[
          { label: "Place", render: (r) => str(r.title) },
          { label: "Views", render: (r) => str(r.views) },
          { label: "Save events", render: (r) => str(r.saves) },
          { label: "Itinerary additions", render: (r) => str(r.planned) },
          { label: "Sessions", render: (r) => str(r.sessions) },
        ]}
      />
      <div className="studio-overview-grid">
        <section>
          <h2>Category interest</h2>
          <p>A Place can belong to more than one category.</p>
          <StudioTable
            caption="Category views"
            rows={list(data?.categories)}
            columns={[
              { label: "Category", render: (r) => str(r.name) },
              { label: "Views", render: (r) => str(r.views) },
            ]}
          />
          <h3>Area interest</h3>
          <StudioTable
            caption="Area views"
            rows={list(data?.areas)}
            columns={[
              { label: "Area", render: (r) => str(r.name) },
              { label: "Views", render: (r) => str(r.views) },
            ]}
          />
        </section>
        <section>
          <h2>Merchandise interest</h2>
          <StudioTable
            caption="Product interest"
            rows={list(data?.products)}
            columns={[
              { label: "Product", render: (r) => str(r.name) },
              { label: "Views", render: (r) => str(r.views) },
              { label: "Bag additions", render: (r) => str(r.bag_additions) },
            ]}
          />
        </section>
      </div>
      <details className="studio-form-section">
        <summary>Current saved & planned Places</summary>
        <p>
          Current records across all dates. These snapshots are not historical
          action counts.
        </p>
        <h3>Most saved now</h3>
        <StudioTable
          caption="Current Bucketlist saves"
          rows={list(data?.current_saves)}
          columns={[
            { label: "Place", render: (r) => str(r.title) },
            { label: "Current saves", render: (r) => str(r.saves) },
          ]}
        />
        <h3>Most planned now</h3>
        <StudioTable
          caption="Current itinerary stops"
          rows={list(data?.current_planned)}
          columns={[
            { label: "Place", render: (r) => str(r.title) },
            { label: "Current stops", render: (r) => str(r.stops) },
          ]}
        />
      </details>
    </>
  );
}
