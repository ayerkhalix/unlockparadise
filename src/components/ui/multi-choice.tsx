"use client";
import { useState } from "react";
export function MultiChoice({
  name,
  label,
  choices,
  initial = [],
  onChange,
}: {
  name: string;
  label: string;
  choices: { value: string; label: string }[];
  initial?: string[];
  onChange?: () => void;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <fieldset className="multi-choice">
      <legend>{label}</legend>
      <label>
        Add {label.toLowerCase()}
        <select
          aria-label={`Add ${label.toLowerCase()}`}
          value=""
          onChange={(e) => {
            if (e.target.value) {
              setSelected([...selected, e.target.value]);
              onChange?.();
            }
          }}
        >
          <option value="">Choose an option</option>
          {choices
            .filter((c) => !selected.includes(c.value))
            .map((c) => (
              <option value={c.value} key={c.value}>
                {c.label}
              </option>
            ))}
        </select>
      </label>
      <ul>
        {selected.map((value) => (
          <li key={value}>
            <input type="hidden" name={name} value={value} />
            <span>
              {choices.find((c) => c.value === value)?.label || value}
            </span>
            <button
              type="button"
              aria-label={`Remove ${choices.find((c) => c.value === value)?.label || value}`}
              onClick={() => {
                setSelected(selected.filter((v) => v !== value));
                onChange?.();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {!selected.length && <p className="p2-muted">None selected</p>}
    </fieldset>
  );
}
