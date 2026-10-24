"use client";
import { ContentImage } from "@/components/ui/content-image";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJSON } from "@/lib/client-api";
import {
  googleMapsUrl,
  mapsLookup,
  nearbyKinds,
  nearbyKindLabels,
  type NearbyPlace,
  type GooglePlacePreview,
} from "@/lib/nearby-places";
import { GoogleAttribution } from "./google-attribution";

type Change = (update: (previous: NearbyPlace[]) => NearbyPlace[]) => void;
function NearbyRow({
  row,
  index,
  total,
  configured,
  onChange,
  onLookupBusy,
}: {
  row: NearbyPlace;
  index: number;
  total: number;
  configured: boolean;
  onChange: Change;
  onLookupBusy: (id: string, busy: boolean) => void;
}) {
  const [choices, setChoices] = useState<GooglePlacePreview[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    onLookupBusy(row.id, busy);
    return () => onLookupBusy(row.id, false);
  }, [row.id, busy, onLookupBusy]);
  const patch = (update: Partial<NearbyPlace>) =>
    onChange((previous) =>
      previous.map((p) => (p.id === row.id ? { ...p, ...update } : p)),
    );
  async function lookup(url: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setChoices([]);
    try {
      const result = await requestJSON<{ data: GooglePlacePreview[] }>(
        "/api/admin/google-places/",
        "POST",
        { url },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setChoices(result.data);
      if (result.data.length === 1)
        patch({ google_place_id: result.data[0].id });
      if (!result.data.length)
        setError(
          "No matching place found. Check the Maps link; your other changes are kept.",
        );
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function changeUrl(url: string) {
    request.current?.abort();
    setBusy(false);
    setChoices([]);
    setError("");
    let name = row.name;
    try {
      if (!name)
        name = (mapsLookup(googleMapsUrl(url)!).query || "").slice(0, 160);
    } catch {
      /* A manual display name remains available. */
    }
    patch({ maps_url: url, google_place_id: "", name });
  }
  return (
    <li className="nearby-editor__row" aria-busy={busy}>
      <div className="nearby-editor__row-heading">
        <h3>{row.name || "New nearby place"}</h3>
        <div className="p2-actions">
          <button
            type="button"
            disabled={index === 0}
            aria-label={`Move up: nearby place ${index + 1}`}
            onClick={() =>
              onChange((previous) => {
                const next = [...previous];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                return next;
              })
            }
          >
            Move up
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            aria-label={`Move down: nearby place ${index + 1}`}
            onClick={() =>
              onChange((previous) => {
                const next = [...previous];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                return next;
              })
            }
          >
            Move down
          </button>
          <button
            type="button"
            aria-label={`Remove nearby place ${index + 1}`}
            onClick={() =>
              onChange((previous) => previous.filter((p) => p.id !== row.id))
            }
          >
            Remove
          </button>
        </div>
      </div>
      <div className="admin-fields">
        <label>
          Display name
          <input
            value={row.name}
            maxLength={160}
            required
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <label>
          Type
          <select
            aria-label="Type"
            value={row.kind}
            onChange={(e) =>
              patch({ kind: e.target.value as NearbyPlace["kind"] })
            }
          >
            {nearbyKinds.map((v) => (
              <option key={v} value={v}>
                {nearbyKindLabels[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Google Maps place link
        <input
          type="url"
          value={row.maps_url}
          maxLength={2048}
          required
          placeholder="https://maps.app.goo.gl/…"
          onChange={(e) => changeUrl(e.target.value)}
          onPaste={(e) => {
            const url = e.clipboardData.getData("text").trim();
            if (googleMapsUrl(url)) {
              e.preventDefault();
              changeUrl(url);
              if (configured) void lookup(url);
            }
          }}
        />
      </label>
      <div className="nearby-editor__lookup">
        <button
          type="button"
          disabled={!configured || busy || !googleMapsUrl(row.maps_url)}
          onClick={() => void lookup(row.maps_url)}
        >
          {busy
            ? "Finding photo…"
            : row.google_place_id
              ? "Refresh Google photo"
              : "Find Google photo"}
        </button>
        {row.google_place_id && <span>Google place linked</span>}
      </div>
      {error && <p role="alert">{error}</p>}
      {choices.length > 0 && (
        <div
          className="nearby-editor__matches"
          aria-label="Google Maps matches"
        >
          {choices.length > 1 && (
            <p>Choose the correct place to enable its photo.</p>
          )}
          {choices.map((p) => (
            <div className="nearby-editor__match" key={p.id}>
              <figure>
                {p.photo && (
                  <ContentImage src={p.photo} alt="" width={160} height={112} />
                )}
                <GoogleAttribution place={p} />
              </figure>
              <div>
                <strong>{p.name}</strong>
                <p>{p.address}</p>
                {!p.photo && <p>No Google photo available.</p>}
                <button
                  type="button"
                  disabled={p.id === row.google_place_id}
                  onClick={() => patch({ google_place_id: p.id })}
                >
                  {p.id === row.google_place_id ? "Selected" : "Use this place"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <label>
        Why stop here? (optional)
        <textarea
          className="resize-none"
          rows={2}
          maxLength={500}
          value={row.note}
          onChange={(e) => patch({ note: e.target.value })}
        />
      </label>
    </li>
  );
}
export function NearbyPlaceEditor({
  value,
  onChange,
  onBusyChange,
}: {
  value: NearbyPlace[];
  onChange: Change;
  onBusyChange: (value: boolean) => void;
}) {
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const onLookupBusy = useCallback((id: string, busy: boolean) => {
    setLoadingIds((previous) =>
      busy
        ? previous.includes(id)
          ? previous
          : [...previous, id]
        : previous.includes(id)
          ? previous.filter((v) => v !== id)
          : previous,
    );
  }, []);
  useEffect(() => {
    onBusyChange(loadingIds.length > 0);
    return () => onBusyChange(false);
  }, [loadingIds, onBusyChange]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [setupError, setSetupError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestJSON<{ configured: boolean }>(
      "/api/admin/google-places/",
      "GET",
      undefined,
      controller.signal,
    )
      .then((r) => {
        setConfigured(r.configured);
        setSetupError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setSetupError((e as Error).message);
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <section
      id="place-nearby"
      className="place-editor-section nearby-editor"
      aria-labelledby="nearby-editor-title"
    >
      <h2 id="nearby-editor-title">Recommended nearby</h2>
      <p>
        Add cafés, restaurants, stays or local stops worth visiting around this
        destination. Paste a place’s Google Maps Share link to find its photo.
      </p>
      {configured === null && !setupError && (
        <p role="status">Checking Google photo setup…</p>
      )}
      {setupError && (
        <div role="alert">
          <p>{setupError} Your Place changes are kept.</p>
          <button
            type="button"
            onClick={() => {
              setSetupError("");
              setRetry(retry + 1);
            }}
          >
            Retry photo setup
          </button>
        </div>
      )}
      {configured === false && (
        <p className="nearby-editor__setup">
          Google photos will be available after setup. Names, links and notes
          can be saved now.
        </p>
      )}
      <ol>
        {value.map((row, index) => (
          <NearbyRow
            key={row.id}
            row={row}
            index={index}
            total={value.length}
            configured={configured === true}
            onChange={onChange}
            onLookupBusy={onLookupBusy}
          />
        ))}
      </ol>
      {value.length === 0 && <p className="p2-muted">No nearby places yet.</p>}
      <button
        type="button"
        disabled={value.length >= 6}
        onClick={() =>
          onChange((previous) => [
            ...previous,
            {
              id: crypto.randomUUID(),
              name: "",
              maps_url: "",
              google_place_id: "",
              kind: "food",
              note: "",
            },
          ])
        }
      >
        Add nearby place
      </button>
      <p className="p2-muted">
        Up to 6 places. Saved with the Place; your order is kept.
      </p>
    </section>
  );
}
