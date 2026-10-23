"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlaceEditor } from "./place-editor";
import { ProductEditor } from "./admin/product-editor";
import { StudioModule } from "./admin/modules";
import { Modal } from "./ui/modal";
import { useDecision } from "./ui/decision";
import { Icon } from "./icon";
import { adminRequest, type Row } from "./admin/shared";
import { AdminBrand, AdminThemeToggle } from "./admin-theme";
const modules = [
  { id: "overview", label: "Overview", icon: "Location" },
  { id: "places", label: "Places", icon: "Location" },
  { id: "merchandise", label: "Merchandise", icon: "Cart" },
  { id: "orders", label: "Orders & Sales", icon: "Cart" },
  { id: "analytics", label: "Analytics", icon: "Clock" },
  { id: "members", label: "Members", icon: "People" },
  { id: "reviews", label: "Reviews", icon: "Star" },
  { id: "settings", label: "Settings", icon: "Lock" },
];
const descriptions: Record<string, string> = {
  overview: "Publishing, orders and recent activity.",
  places: "Edit destinations, traveler recommendations and nearby stops.",
  merchandise: "Products, brands and collections.",
  orders: "Recorded orders and confirmed sales. Checkout remains closed.",
  analytics: "Destination views, saved places and traveler interests.",
  members: "Accounts and membership access.",
  reviews: "Review and publish traveler feedback.",
  settings: "Site preferences, security and activity log.",
};
export type StudioNavigation = (
  section: string,
  filters?: Record<string, string>,
) => void;
export function AdminConsole({
  administrator,
  content,
  orders,
  mfaVerified,
}: {
  administrator: boolean;
  content: boolean;
  orders: boolean;
  mfaVerified: boolean;
}) {
  const params = useSearchParams();
  const [saving, setSaving] = useState(false);
  const { ask, dialog } = useDecision();
  const allowed = modules.filter(
    (m) =>
      m.id === "overview" ||
      (content && ["places", "reviews"].includes(m.id)) ||
      (orders && m.id === "orders") ||
      (administrator &&
        ["merchandise", "analytics", "members", "settings"].includes(m.id)),
  );
  const section = allowed.some((m) => m.id === params.get("section"))
    ? params.get("section")!
    : "overview";
  const [edit, setEdit] = useState<{
      kind: "place" | "product";
      row: Row | null;
    } | null>(null),
    [dirty, setDirty] = useState(false),
    [mobile, setMobile] = useState(false),
    [error, setError] = useState(""),
    [opening, setOpening] = useState(false),
    [revision, setRevision] = useState(0);
  function update(changes: Record<string, string>, replace = false) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      `/admin/${next.size ? "?" + next : ""}`,
    );
  }
  async function navigate(id: string, filters: Record<string, string> = {}) {
    if (saving) {
      setError("Please wait for the current save to finish.");
      return;
    }
    if (
      dirty &&
      !(await ask("Discard unsaved changes before leaving this editor?"))
    )
      return;
    setDirty(false);
    setEdit(null);
    setMobile(false);
    setError("");
    update({
      section: id,
      search: "",
      status: "",
      area: "",
      category: "",
      access: "",
      sort: "",
      payment: "",
      fulfillment: "",
      view: "",
      page: "",
      ...filters,
    });
  }
  async function openEditor(kind: "place" | "product", row: Row | null) {
    if (kind === "product" || !row) {
      setEdit({ kind, row });
      return;
    }
    setOpening(true);
    setError("");
    try {
      const result = await adminRequest(`places/${row.id}`);
      if (!result.data?.[0])
        throw new Error("This Place is no longer available.");
      setEdit({ kind, row: result.data[0] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Place.");
    } finally {
      setOpening(false);
    }
  }
  const nav = (
    <nav aria-label="Admin Studio">
      {allowed.map((m) => (
        <a
          key={m.id}
          href={`/admin/?section=${m.id}`}
          aria-current={section === m.id ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            void navigate(m.id);
          }}
        >
          <Icon name={m.icon} size={20} />
          <span>{m.label}</span>
        </a>
      ))}
    </nav>
  );
  const done = () => {
    setDirty(false);
    setEdit(null);
    setRevision((v) => v + 1);
  };
  const sidebarUtilities = (
    <div className="studio-sidebar-foot">
      <div className="studio-access-status">
        <Icon name="Lock" size={18} />
        <span>
          {mfaVerified ? "MFA verified" : "Client review access"}
          <small>
            {administrator
              ? "Owner"
              : content
                ? "Content editor"
                : "Order manager"}
          </small>
        </span>
      </div>
      <div
        className="studio-utilities"
        aria-label="Studio preferences and account"
      >
        <AdminThemeToggle />
        <a href="/account/">
          <Icon name="Person" size={18} />
          My account
        </a>
        <a href="/">
          <Icon name="Location" size={18} />
          View website
        </a>
      </div>
    </div>
  );
  return (
    <div className="studio">
      {dialog}
      <aside className="studio-sidebar">
        <a
          className="studio-brand"
          href="/admin/"
          onClick={(e) => {
            e.preventDefault();
            void navigate("overview");
          }}
        >
          <AdminBrand />
        </a>
        {nav}
        {sidebarUtilities}
      </aside>
      <div className="studio-main">
        <header className="studio-topbar">
          <strong>{allowed.find((m) => m.id === section)?.label}</strong>
          <button
            className="studio-menu"
            aria-label="Open studio menu"
            aria-haspopup="dialog"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <Icon name="Menu" size={20} />
            Menu
          </button>
        </header>
        <div className="studio-content">
          {error && (
            <p role="alert" className="studio-error">
              {error}
            </p>
          )}
          {opening && <p role="status">Opening Place…</p>}
          {edit ? (
            edit.kind === "place" ? (
              <PlaceEditor
                initial={edit.row}
                onClose={done}
                onDirtyChange={setDirty}
                onBusyChange={setSaving}
              />
            ) : (
              <ProductEditor
                initial={edit.row}
                onClose={done}
                onDirty={setDirty}
                onBusyChange={setSaving}
              />
            )
          ) : (
            <>
              <div className="studio-heading">
                <div>
                  <h1>{allowed.find((m) => m.id === section)?.label}</h1>
                  <p>{descriptions[section]}</p>
                </div>
                <div className="admin-actions">
                  {section === "places" && (
                    <button
                      className="admin-primary"
                      onClick={() => openEditor("place", null)}
                    >
                      Add Place
                    </button>
                  )}
                  {section === "merchandise" && (
                    <button
                      className="admin-primary"
                      onClick={() => openEditor("product", null)}
                    >
                      Add product
                    </button>
                  )}
                </div>
              </div>
              <StudioModule
                key={`${section}:${revision}`}
                section={section}
                administrator={administrator}
                content={content}
                orders={orders}
                params={params}
                update={update}
                navigate={navigate}
                openEditor={openEditor}
              />
            </>
          )}
        </div>
      </div>
      {mobile && (
        <Modal title="Admin Studio" onClose={() => setMobile(false)} drawer>
          <div className="studio-navigation-panel">
            <div className="studio-drawer-brand">
              <AdminBrand />
            </div>
            {nav}
            {sidebarUtilities}
          </div>
        </Modal>
      )}
    </div>
  );
}
