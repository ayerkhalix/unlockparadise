"use client";
import { useRef, useState } from "react";
export function CatalogChoice({
  label,
  value,
  choices,
  onChange,
  onCreate,
  disabled = false,
}: {
  label: string;
  value: string;
  choices: { value: string; label: string }[];
  onChange: (v: string) => void;
  onCreate?: (v: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null),
    inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="catalog-choice">
      <label>
        {label}
        <select
          ref={selectRef}
          aria-label={label}
          value={value}
          required
          disabled={disabled || busy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {value && !choices.some((c) => c.value === value) && (
            <option value={value}>{value}</option>
          )}
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {onCreate && !adding && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAdding(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Add {label.toLowerCase()}
        </button>
      )}
      {adding && (
        <div className="catalog-choice__new">
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
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onCreate?.(draft.trim());
                setAdding(false);
                setDraft("");
                requestAnimationFrame(() => selectRef.current?.focus());
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not save this option.",
                );
                requestAnimationFrame(() => inputRef.current?.focus());
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setError("");
              requestAnimationFrame(() => selectRef.current?.focus());
            }}
          >
            Cancel
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
