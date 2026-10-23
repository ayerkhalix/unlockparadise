"use client";
import { useState } from "react";
import { Modal } from "../ui/modal";
import { ValidatedForm } from "../ui/validated-form";
import { useDecision } from "../ui/decision";
import {
  adminRequest,
  date,
  list,
  LoadState,
  Status,
  str,
  StudioTable,
  useAdminData,
  activityRecord,
  activityAction,
  type Row,
  type AdminData,
} from "./shared";
import { php } from "@/lib/commerce";
import { notify } from "@/lib/client-api";
type DetailProps = { row: Row; onClose: () => void; onSaved: () => void };
export function activeMember(row: Row) {
  return list(row.entitlements).some(
    (e) =>
      !e.revoked_at &&
      Date.parse(String(e.starts_at || 0)) <= Date.now() &&
      (!e.expires_at || Date.parse(String(e.expires_at)) > Date.now()) &&
      (e.source === "manual" ||
        e.source === "legacy" ||
        list(row.subscriptions).some(
          (s) =>
            s.id === e.subscription_id &&
            ["active", "cancelled"].includes(String(s.status)) &&
            Date.parse(String(s.paid_through)) > Date.now(),
        )),
  );
}
export function OrderDetails({ row, onClose, onSaved }: DetailProps) {
  const { ask, dialog } = useDecision();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const current = String(row.fulfillment_status),
    states = [current];
  if (["paid", "partially_refunded"].includes(String(row.payment_status))) {
    const next = (
      {
        unfulfilled: "processing",
        processing: "shipped",
        shipped: "delivered",
      } as Record<string, string>
    )[current];
    if (next) states.push(next);
  }
  if (
    ["unfulfilled", "processing"].includes(current) &&
    ["pending", "failed", "expired", "refunded"].includes(
      String(row.payment_status),
    )
  )
    states.push("cancelled");
  return (
    <>
      {dialog}
      <Modal
        title={`Order ${str(row.id).slice(0, 8)}`}
        onClose={async () => {
          if (!dirty || (await ask("Discard unsaved order notes?"))) onClose();
        }}
      >
        <p>
          Recorded {date(row.created_at)} ·{" "}
          <Status value={row.payment_status} />
        </p>
        <p>
          Total {php(Number(row.total_centavos))} · Refunded{" "}
          {php(Number(row.refunded_centavos))}
        </p>
        <p>
          Provider payment: {str(row.provider_payment_id || "Not confirmed")}
        </p>
        <ul>
          {list(row.merch_order_items).map((i) => (
            <li key={str(i.id)}>
              {str(i.product_name)} · {str(i.variant_label)} ·{" "}
              {i.quantity as number} × {php(Number(i.unit_centavos))}
            </li>
          ))}
        </ul>
        <ValidatedForm
          className="p2-form"
          data-backend="true"
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              !(await ask(
                `Save fulfillment as ${String(f.get("state"))}? Payment status will remain provider-controlled.`,
              ))
            )
              return;
            setBusy(true);
            setError("");
            try {
              await adminRequest(`orders/${row.id}`, "PATCH", {
                expected_version: Number(row.version),
                fulfillment_status: f.get("state"),
                internal_note: f.get("note"),
              });
              notify("Order updated.");
              onSaved();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Order could not be saved.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Fulfillment
            <select
              name="state"
              aria-label="Fulfillment"
              defaultValue={current}
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Internal order note
            <textarea
              className="resize-none"
              name="note"
              maxLength={2000}
              rows={4}
              defaultValue={String(row.internal_note || "")}
            />
          </label>
          <p>
            Payment confirmation and refunds require verified provider evidence.
            Inventory is not restored automatically by a refund.
          </p>
          {error && <p role="alert">{error}</p>}
          <button className="p2-button" disabled={busy}>
            {busy ? "Saving…" : "Save order"}
          </button>
        </ValidatedForm>
      </Modal>
    </>
  );
}
export function ReviewDetails({ row, onClose, onSaved }: DetailProps) {
  const { ask, dialog } = useDecision(),
    state = useAdminData(`reviews/${row.id}`);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      {dialog}
      <Modal title="Review details" onClose={onClose}>
        <p>
          {str((row.places as Row)?.title)} · {str(row.author_name)} ·{" "}
          {str(row.rating)} / 5
        </p>
        <h3>{str(row.title || "Untitled review")}</h3>
        <p className="studio-review-body">{str(row.body)}</p>
        <p>
          Current status: <Status value={row.status} />
        </p>
        <div className="p2-actions">
          {[
            ["approved", "Publish"],
            ["pending", "Return to pending"],
            ["rejected", "Hide review"],
          ].map(([status, label]) => (
            <button
              className="p2-button p2-button--quiet"
              key={status}
              disabled={busy || row.status === status}
              onClick={async () => {
                if (
                  !(await ask(
                    `${label} by ${str(row.author_name)}? This changes public visibility and is recorded in moderation history.`,
                  ))
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await adminRequest(`reviews/${row.id}`, "PATCH", { status });
                  notify("Review moderation saved.");
                  onSaved();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not moderate review.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <h3>Moderation history</h3>
        <ul>
          {list(state.data?.history).map((r, i) => (
            <li key={i}>
              {date(r.at)} · {str(r.action).toLowerCase()} ·{" "}
              {str(
                ((r.summary as Row)?.status as Row)?.to || "Review recorded",
              )}
            </li>
          ))}
        </ul>
        <LoadState
          loading={state.loading}
          error={state.error}
          retry={state.reload}
        />
      </Modal>
    </>
  );
}
export function MemberTools({ row, onClose, onSaved }: DetailProps) {
  const { ask, dialog } = useDecision();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await adminRequest(path, method, body);
      notify("Member access updated.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update member.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {dialog}
      <Modal title={str(row.display_name)} onClose={onClose}>
        <p>
          {activeMember(row) ? "Explorer+ active" : "Explorer"} · Joined{" "}
          {date(row.created_at)}
        </p>
        <p className="p2-muted">Account {str(row.id)}</p>
        <h3>Membership access</h3>
        {list(row.entitlements).length ? (
          <ul>
            {list(row.entitlements).map((e) => (
              <li key={str(e.id)}>
                {str(e.source)} · {date(e.starts_at)} to{" "}
                {e.expires_at ? date(e.expires_at) : "No expiry"} ·{" "}
                {e.revoked_at ? "Revoked" : "Recorded"}
                {!e.revoked_at && (
                  <button
                    className="p2-button p2-button--quiet"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await ask(
                          `Revoke this ${str(e.source)} entitlement for ${str(row.display_name)}? Other valid entitlements may still provide access.`,
                        )
                      )
                        void save(`entitlements/${e.id}`, "PATCH", {
                          revoke: true,
                        });
                    }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No Explorer+ entitlements.</p>
        )}
        <details>
          <summary>Grant Explorer+</summary>
          <ValidatedForm
            className="p2-form"
            data-backend="true"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                !(await ask(
                  `Grant Explorer+ to ${str(row.display_name)}? This manual access change is audited.`,
                ))
              )
                return;
              void save("entitlements", "POST", {
                user_id: row.id,
                expires_at: f.get("expires")
                  ? new Date(String(f.get("expires"))).toISOString()
                  : null,
                reason: f.get("reason"),
              });
            }}
          >
            <label>
              Expires (your local time; blank for no expiry)
              <input type="datetime-local" name="expires" />
            </label>
            <label>
              Reason
              <input name="reason" required minLength={5} maxLength={1000} />
            </label>
            <button className="p2-button" disabled={busy}>
              Grant membership
            </button>
          </ValidatedForm>
        </details>
        <details>
          <summary>Studio permissions</summary>
          <ValidatedForm
            className="p2-form"
            data-backend="true"
            onSubmit={async (e) => {
              e.preventDefault();
              const role = new FormData(e.currentTarget).get("role");
              if (
                await ask(
                  `Change studio access for ${str(row.display_name)} to ${str(role)}? Owner access includes financial and security management.`,
                )
              )
                void save(`users/${row.id}`, "PATCH", {
                  role: role === "member" ? null : role,
                });
            }}
          >
            <label>
              Administrative role
              <select
                aria-label="Administrative role"
                name="role"
                defaultValue={String((row.user_roles as Row)?.role || "member")}
              >
                <option value="member">Member · no studio access</option>
                <option value="editor">Content editor</option>
                <option value="order_manager">Order manager</option>
                <option value="admin">Owner</option>
              </select>
            </label>
            <p>
              All studio roles require MFA. The last owner cannot be removed.
            </p>
            <button className="p2-button" disabled={busy}>
              Save access
            </button>
          </ValidatedForm>
        </details>
        <details>
          <summary>Membership payments & subscriptions</summary>
          <ul>
            {list(row.subscriptions).map((s) => (
              <li key={str(s.id)}>
                {str(s.plan_id)} · {str(s.status)} · paid through{" "}
                {date(s.paid_through)}
              </li>
            ))}
            {list(row.payment_transactions).map((p) => (
              <li key={str(p.id)}>
                {str(p.status)} · {php(Number(p.amount_centavos))} ·{" "}
                {str(p.provider_payment_id || "No provider payment")}
              </li>
            ))}
          </ul>
        </details>
        {error && <p role="alert">{error}</p>}
      </Modal>
    </>
  );
}
export function SettingsTools({
  view,
  data,
  rows,
  run,
  working,
}: {
  view: string;
  data: AdminData | null;
  rows: Row[];
  run: (path: string, method: string, body: unknown) => Promise<void>;
  working: boolean;
}) {
  const { ask, dialog } = useDecision();
  if (view === "site")
    return (
      <>
        {dialog}
        <h2>Site & security</h2>
        <p className="studio-note">
          MFA protects every privileged route and database operation. Manage
          administrator access through Members. Payment credentials stay on the
          server.
        </p>
        {rows.map((r) => {
          const options = (
            {
              place_gate: [
                ["walled", "Signed-in members"],
                ["public", "Public standard Places"],
              ],
              review_write_level: [
                ["member", "All signed-in members"],
                ["vip", "Explorer+ only"],
              ],
              review_moderation: [
                ["auto", "Publish automatically"],
                ["hold", "Hold for review"],
              ],
              avatar_moderation: [
                ["auto", "Approve automatically"],
                ["hold", "Hold for approval"],
              ],
            } as Record<string, string[][]>
          )[str(r.key)];
          return options ? (
            <label key={str(r.key)} className="studio-setting">
              {
                (
                  {
                    place_gate: "Standard Place access",
                    review_write_level: "Who can write reviews",
                    review_moderation: "New review moderation",
                    avatar_moderation: "New profile photo moderation",
                  } as Record<string, string>
                )[str(r.key)]
              }
              <select
                disabled={working}
                value={String(r.value)}
                onChange={async (e) => {
                  const value = e.target.value;
                  if (
                    await ask(
                      `Change ${str(r.key).replaceAll("_", " ")} to ${options.find((o) => o[0] === value)?.[1]}? This affects site behavior.`,
                    )
                  )
                    void run(`settings/${r.key}`, "PATCH", { value });
                }}
              >
                {options.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <ContentSettings
              key={str(r.key)}
              row={r}
              run={run}
              working={working}
            />
          );
        })}
      </>
    );
  if (view === "integrations")
    return (
      <>
        <h2>Connections & storage</h2>
        <dl className="studio-definitions">
          {[
            ["Supabase staging project", data?.project],
            ["Payment provider", data?.payments],
            ["Merchandise checkout", data?.merch_checkout],
            ["Analytics", data?.analytics],
            ["Email", data?.email],
            ["Mapped media records", data?.media_records],
            [
              "Stored objects in app buckets",
              data?.stored_bytes == null
                ? "Unavailable"
                : `${(Number(data.stored_bytes) / 1048576).toFixed(2)} MB`,
            ],
            ["Upload limit", "5 MB per image"],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{str(value)}</dd>
            </div>
          ))}
        </dl>
        <p>{str(data?.storage)}</p>
        <p>
          No original media library is uploaded automatically. Original assets
          and mappings remain available.
        </p>
      </>
    );
  if (view === "activity")
    return (
      <>
        <h2>Activity log</h2>
        <StudioTable
          caption="Administrative audit history"
          rows={rows}
          columns={[
            { label: "When", render: (r) => date(r.at) },
            {
              label: "Actor",
              render: (r) => (
                <span className="studio-reference">
                  {str(r.actor_id || "System / import")}
                </span>
              ),
            },
            { label: "Action", render: (r) => activityAction(r.action) },
            {
              label: "Entity",
              render: (r) => activityRecord(r.table_name),
            },
            {
              label: "Reference",
              render: (r) => (
                <span className="studio-reference">{str(r.record_id)}</span>
              ),
            },
            {
              label: "Change",
              render: (r) => (
                <ul>
                  {Object.entries((r.summary || {}) as Row).map(([k, v]) => (
                    <li key={k}>
                      {k.replaceAll("_", " ")}: {str((v as Row).from)} →{" "}
                      {str((v as Row).to)}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </>
    );
  if (view === "contacts")
    return (
      <>
        <h2>Contact inbox</h2>
        <StudioTable
          caption="Contact submissions"
          rows={rows}
          columns={[
            { label: "Received", render: (r) => date(r.created_at) },
            { label: "From", render: (r) => str(r.name) },
            { label: "Email", render: (r) => str(r.email) },
            { label: "Message", render: (r) => str(r.message) },
            {
              label: "Status",
              render: (r) => (r.resolved_at ? "Resolved" : "Received"),
            },
          ]}
        />
      </>
    );
  if (view === "payments")
    return (
      <>
        <h2>Explorer+ payment records</h2>
        <p>
          Membership payments are separate from merchandise sales. Payment state
          is provider-controlled.
        </p>
        <StudioTable
          caption="Membership sandbox transactions"
          rows={rows}
          columns={[
            { label: "Recorded", render: (r) => date(r.created_at) },
            { label: "Plan", render: (r) => str(r.plan_id) },
            { label: "Amount", render: (r) => php(Number(r.amount_centavos)) },
            { label: "Status", render: (r) => <Status value={r.status} /> },
            {
              label: "Provider payment",
              render: (r) => str(r.provider_payment_id || "Not confirmed"),
            },
          ]}
        />
      </>
    );
  return null;
}
function ContentSettings({
  row,
  run,
  working,
}: {
  row: Row;
  run: (path: string, method: string, body: unknown) => Promise<void>;
  working: boolean;
}) {
  const { ask, dialog } = useDecision();
  const existing = (row.value || {}) as Row;
  const display = [
    "description",
    "gallery",
    "area_location",
    "travel_time",
    "accessible_by",
    "assets",
    "weekdays_crowd",
    "weekends_crowd",
  ];
  const names: Record<string, string> = {
    description: "Description",
    gallery: "Gallery",
    area_location: "Location",
    travel_time: "Travel information",
    accessible_by: "Transport modes",
    assets: "Destination assets",
    weekdays_crowd: "Weekday crowd",
    weekends_crowd: "Weekend crowd",
  };
  const assets = [
    "Sunrise view",
    "Sunset view",
    "Surfing spot",
    "Accommodation available",
    "Culture",
    "Activities",
    "Food",
  ];
  const descriptions =
    row.key === "asset_descriptions"
      ? [
          ...assets.map((label) => ({
            label,
            key:
              "place_asset_desc_" +
              label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          })),
          ...["Motorcycle", "Car", "4x4", "Boat"].map((label) => ({
            label: label + " access",
            key: "place_access_desc_" + label.toLowerCase(),
          })),
        ]
      : [];
  return (
    <details className="studio-form-section">
      {dialog}
      <summary>
        {row.key === "place_display"
          ? "Destination display"
          : "Destination help text"}
      </summary>
      <ValidatedForm
        data-backend="true"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (
            !(await ask(
              "Change these destination display settings? Existing unrelated configuration is retained.",
            ))
          )
            return;
          const value = { ...existing };
          if (row.key === "place_display") {
            for (const field of display)
              value["place_show_" + field] = f.has("show_" + field);
            for (const field of ["gallery", "area_location"])
              value["place_heading_" + field] = String(
                f.get("heading_" + field) || "",
              );
          } else
            for (const d of descriptions)
              value[d.key] = String(f.get(d.key) || "");
          void run(`settings/${row.key}`, "PATCH", { value });
        }}
      >
        {row.key === "place_display" ? (
          <>
            <fieldset>
              <legend>Show on Place details</legend>
              {display.map((field) => (
                <label key={field}>
                  <input
                    type="checkbox"
                    name={"show_" + field}
                    defaultChecked={
                      ![false, 0, "0"].includes(
                        existing["place_show_" + field] as
                          boolean | number | string,
                      )
                    }
                  />
                  {names[field]}
                </label>
              ))}
            </fieldset>
            <div className="admin-fields">
              {["gallery", "area_location"].map((field) => (
                <label key={field}>
                  {names[field]} heading
                  <input
                    name={"heading_" + field}
                    maxLength={200}
                    defaultValue={String(
                      existing["place_heading_" + field] || names[field],
                    )}
                  />
                </label>
              ))}
            </div>
          </>
        ) : (
          descriptions.map((d) => (
            <label key={d.key}>
              {d.label}
              <input
                name={d.key}
                maxLength={1000}
                defaultValue={String(existing[d.key] || "")}
              />
            </label>
          ))
        )}
        <button type="submit" disabled={working}>
          Save display settings
        </button>
      </ValidatedForm>
    </details>
  );
}
