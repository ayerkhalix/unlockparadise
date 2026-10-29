"use client";
import { useRef, useState } from "react";
export function CatalogChoice({
  label,
  value,
  choices,
  onChange,
  onCreate,
  tagline = "",
  onSaveTagline,
  disabled = false,
  loading = false,
}: {
  label: string;
  value: string;
  choices: { value: string; label: string }[];
  onChange: (v: string) => void;
  onCreate?: (v: string, tagline?: string) => Promise<void>;
  tagline?: string;
  onSaveTagline?: (v: string) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [adding, setAdding] = useState(false),
    [editingTagline, setEditingTagline] = useState(false),
    [draftTagline, setDraftTagline] = useState(""),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null),
    inputRef = useRef<HTMLInputElement>(null),
    taglineRef = useRef<HTMLInputElement>(null);
  const close = () => {
    setAdding(false);
    setEditingTagline(false);
    setDraft("");
    setDraftTagline("");
    setError("");
    requestAnimationFrame(() => selectRef.current?.focus());
  };
  const save = async () => {
    if (busy || (adding && !draft.trim())) return;
    setBusy(true);
    setError("");
    try {
      if (adding) await onCreate?.(draft.trim(), draftTagline.trim());
      else await onSaveTagline?.(draftTagline.trim());
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this option.");
      requestAnimationFrame(() =>
        (adding ? inputRef : taglineRef).current?.focus(),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="catalog-choice">
      <label>
        {label}
        <select
          ref={selectRef}
          aria-label={label}
          value={value}
          required
          aria-busy={loading || undefined}
          disabled={loading || disabled || busy || adding || editingTagline}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {value && !choices.some((c) => c.value === value) && (
            <option value={value}>
              {loading
                ? `Loading ${label.toLowerCase()}…`
                : /^[0-9a-f-]{36}$/i.test(value)
                  ? `Selected ${label.toLowerCase()} unavailable`
                  : value}
            </option>
          )}
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {tagline && !adding && !editingTagline && (
        <p className="catalog-choice__hint">{tagline}</p>
      )}
      {!adding && !editingTagline && (
        <div className="catalog-choice__actions">
          {onCreate && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setAdding(true);
                setDraftTagline("");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              Add {label.toLowerCase()}
            </button>
          )}
          {onSaveTagline && value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setDraftTagline(tagline);
                setEditingTagline(true);
                requestAnimationFrame(() => taglineRef.current?.focus());
              }}
            >
              Edit collection tagline
            </button>
          )}
        </div>
      )}
      {(adding || editingTagline) && (
        <div
          className="catalog-choice__new"
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape" && !busy) {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        >
          {adding && (
            <label>
              New {label.toLowerCase()}
              <input
                ref={inputRef}
                maxLength={80}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          {onSaveTagline && (
            <label className="catalog-choice__tagline">
              Collection tagline (optional)
              <input
                ref={taglineRef}
                maxLength={160}
                value={draftTagline}
                onChange={(e) => setDraftTagline(e.target.value)}
                disabled={busy}
                placeholder="Find your way"
              />
              <span className="catalog-choice__hint">
                Small text below the collection name in the store. Saved for the
                whole collection.
              </span>
            </label>
          )}
          <button
            type="button"
            disabled={busy || (adding && !draft.trim())}
            onClick={save}
          >
            {busy ? "Saving…" : adding ? "Add" : "Save tagline"}
          </button>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
