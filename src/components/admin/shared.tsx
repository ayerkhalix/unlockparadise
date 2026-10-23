"use client";
import { useEffect, useState, useCallback } from "react";
import { SearchInput } from "../ui/search-input";
export type Row = Record<string, unknown>;
export type AdminData = Record<string, unknown> & {
  data?: Row[];
  count?: number;
};
export const str = (value: unknown) => (value == null ? "—" : String(value));
export const list = (value: unknown) =>
  Array.isArray(value) ? (value as Row[]) : [];
export const date = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
      })
        .format(new Date(String(value)))
        .replace(/\s/gu, " ")
    : "—";
export async function adminRequest<T = AdminData>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const [resource, query] = path.split("?");
  const response = await fetch(
    `/api/admin/${resource}/` + (query ? `?${query}` : ""),
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Your session expired. Sign in again; your input is still here."
        : result.error || "Could not complete the request.",
    );
  return result as T;
}
export function useAdminData(path: string | null) {
  const [state, setState] = useState<{
    data: AdminData | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(
      () => {
        setState((s) => ({ ...s, loading: true, error: "" }));
        void adminRequest(path, "GET", undefined, controller.signal)
          .then((data) => {
            if (active) setState({ data, loading: false, error: "" });
          })
          .catch((e) => {
            if (active && e.name !== "AbortError")
              setState((s) => ({ ...s, loading: false, error: e.message }));
          });
      },
      path.includes("search=") ? 300 : 0,
    );
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, revision]);
  return { ...state, reload };
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return (
    <div className="studio-load" aria-live="polite">
      {loading ? (
        <p role="status">Loading records…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
          <a href="/login/?redirect_to=/admin/">Sign in again</a>
        </div>
      ) : null}
    </div>
  );
}
export function Status({ value }: { value: unknown }) {
  return (
    <span className={`studio-status studio-status--${str(value)}`}>
      {(
        {
          publish: "Published",
          draft: "Draft",
          archived: "Archived",
          approved: "Published",
          rejected: "Hidden",
          pending: "Pending",
          paid: "Paid",
          partially_refunded: "Partly refunded",
          refunded: "Refunded",
        } as Record<string, string>
      )[str(value)] || str(value).replaceAll("_", " ")}
    </span>
  );
}
export type Column = { label: string; render: (row: Row) => React.ReactNode };
export function StudioTable({
  rows,
  columns,
  empty = "No records yet.",
  caption,
}: {
  rows: Row[];
  columns: Column[];
  empty?: string;
  caption: string;
}) {
  return (
    <div
      className="admin-table"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption className="studio-sr">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.label}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={str(row.id || row.key || row.user_id || i)}>
              {columns.map((c) => (
                <td key={c.label} data-label={c.label}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="studio-empty">
          <p>{empty}</p>
        </div>
      )}
    </div>
  );
}
export function Pagination({
  count,
  page,
  onPage,
  busy,
}: {
  count: number;
  page: number;
  onPage: (p: number) => void;
  busy: boolean;
}) {
  return (
    <div className="studio-pagination">
      <span>
        {count
          ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, count)} of ${count}`
          : "0 records"}
      </span>
      <button disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button
        disabled={page * 25 >= count || busy}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
export function Filters({
  search,
  onSearch,
  children,
  label = "Search",
}: {
  search: string;
  onSearch: (s: string) => void;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="studio-filters">
      <label>
        {label}
        <SearchInput
          label={label}
          value={search}
          onValueChange={onSearch}
          placeholder={label}
        />
      </label>
      {children}
    </div>
  );
}
export function Stats({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="studio-stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
