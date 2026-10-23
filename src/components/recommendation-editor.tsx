"use client";
import { SearchInput } from "./ui/search-input";
import { useEffect, useState } from "react";
import { requestJSON, notify } from "@/lib/client-api";
type Choice = { id: string; title: string; slug: string; status: string };
type Recommendation = { place_id: string; type: string; place: Choice };
export function RecommendationEditor({
  placeId,
  onDirtyChange,
  onBusyChange,
  disabled = false,
}: {
  placeId: string;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<Recommendation[]>([]),
    [search, setSearch] = useState(""),
    [choices, setChoices] = useState<Choice[]>([]),
    [loading, setLoading] = useState(true),
    [searching, setSearching] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    requestJSON<{ data: Recommendation[] }>(
      `/api/admin/recommendations/${placeId}/`,
    )
      .then((r) => {
        if (live) {
          setRows(r.data);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [placeId, retry]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (!search.trim()) {
        setChoices([]);
        return;
      }
      setSearching(true);
      requestJSON<{ data: Choice[] }>(
        `/api/admin/places/?status=publish&search=${encodeURIComponent(search)}`,
        "GET",
        undefined,
        controller.signal,
      )
        .then((r) => setChoices(r.data.filter((p) => p.id !== placeId)))
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, placeId]);
  const reorder = (i: number, d: number) => {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
    onDirtyChange?.(true);
  };
  return (
    <section className="p2-admin-recommendations">
      <h2>Related destinations</h2>
      <p>
        Link to other published destinations on Unlock Paradise. These appear
        after the nearby places, in the order you choose.
      </p>
      {loading ? (
        <p role="status">Loading recommendations…</p>
      ) : (
        <>
          <fieldset disabled={busy || disabled} className="p2-fieldset">
            <label>
              Find a published Place
              <SearchInput
                label="Find a published Place"
                value={search}
                onValueChange={setSearch}
                placeholder=""
              />
            </label>
            {searching ? (
              <p role="status">Searching…</p>
            ) : (
              search && (
                <ul>
                  {choices
                    .filter((p) => !rows.some((r) => r.place_id === p.id))
                    .map((p) => (
                      <li key={p.id}>
                        {p.title}{" "}
                        <button
                          type="button"
                          disabled={rows.length >= 12}
                          onClick={() => {
                            setRows([
                              ...rows,
                              { place_id: p.id, type: "", place: p },
                            ]);
                            setSearch("");
                            onDirtyChange?.(true);
                          }}
                        >
                          Add recommendation
                        </button>
                      </li>
                    ))}
                  {choices.length === 0 && (
                    <li>No matching published Places.</li>
                  )}
                </ul>
              )
            )}
            <ol>
              {rows.map((r, i) => (
                <li key={r.place_id}>
                  <strong>{r.place.title}</strong>
                  <label>
                    Recommendation label (optional)
                    <input
                      maxLength={80}
                      value={r.type}
                      onChange={(e) => {
                        onDirtyChange?.(true);
                        setRows(
                          rows.map((v, n) =>
                            n === i ? { ...v, type: e.target.value } : v,
                          ),
                        );
                      }}
                    />
                  </label>
                  <div className="p2-actions">
                    <button
                      type="button"
                      disabled={!i}
                      aria-label={`Move ${r.place.title} up`}
                      onClick={() => reorder(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === rows.length - 1}
                      aria-label={`Move ${r.place.title} down`}
                      onClick={() => reorder(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRows(rows.filter((_, n) => n !== i));
                        onDirtyChange?.(true);
                      }}
                    >
                      Remove
                    </button>
                    <a
                      href={`/place/${r.place.slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Preview Place ↗
                    </a>
                  </div>
                </li>
              ))}
            </ol>
            {!rows.length && (
              <p>
                No recommendations selected. The public section will be omitted.
              </p>
            )}
            <button
              className="admin-primary"
              type="button"
              onClick={async () => {
                setBusy(true);
                onBusyChange?.(true);
                try {
                  await requestJSON(
                    `/api/admin/recommendations/${placeId}/`,
                    "POST",
                    {
                      items: rows.map((r) => ({
                        place_id: r.place_id,
                        type: r.type,
                      })),
                    },
                  );
                  setError("");
                  onDirtyChange?.(false);
                  notify("Recommendations saved.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                  onBusyChange?.(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save recommendations"}
            </button>
          </fieldset>
        </>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRetry(retry + 1);
            }}
          >
            Reload recommendations
          </button>
        </div>
      )}
    </section>
  );
}
