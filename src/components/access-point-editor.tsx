"use client";
import { useState, type ComponentProps } from "react";
import { accessTypes } from "@/lib/access-points";
import { CoordinatePicker } from "./coordinate-picker";
function AccessPointPicker({
  label,
  ...props
}: ComponentProps<typeof CoordinatePicker> & { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{label}</summary>
      {open && <CoordinatePicker {...props} />}
    </details>
  );
}
export type AccessPointDraft = {
  name: string;
  type: (typeof accessTypes)[number];
  latitude: string;
  longitude: string;
  directions: string;
};
export function AccessPointEditor({
  points,
  onChange,
}: {
  points: AccessPointDraft[];
  onChange: (points: AccessPointDraft[]) => void;
}) {
  const change = (i: number, key: keyof AccessPointDraft, value: string) =>
    onChange(points.map((p, n) => (n === i ? { ...p, [key]: value } : p)));
  return (
    <section className="studio-form-section access-point-editor">
      <h2>Access points</h2>
      <p>
        Add boat departures, drop-offs, trailheads or parking separately from
        the destination. Only add verified locations.
      </p>
      {points.map((p, i) => (
        <fieldset key={i}>
          <legend>Access point {i + 1}</legend>
          <div className="admin-fields">
            <label>
              Name
              <input
                required
                maxLength={120}
                value={p.name}
                onChange={(e) => change(i, "name", e.target.value)}
              />
            </label>
            <label>
              Type
              <select
                aria-label="Type"
                value={p.type}
                onChange={(e) => change(i, "type", e.target.value)}
              >
                {accessTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Latitude
              <input
                required
                type="number"
                min={-90}
                max={90}
                step="any"
                value={p.latitude}
                onChange={(e) => change(i, "latitude", e.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                required
                type="number"
                min={-180}
                max={180}
                step="any"
                value={p.longitude}
                onChange={(e) => change(i, "longitude", e.target.value)}
              />
            </label>
          </div>
          <label>
            Directions (optional)
            <textarea
              className="resize-none"
              maxLength={1000}
              rows={2}
              value={p.directions}
              onChange={(e) => change(i, "directions", e.target.value)}
            />
          </label>
          <AccessPointPicker
            label={`Pick access point ${i + 1} on the map`}
            latitude={p.latitude}
            longitude={p.longitude}
            onPick={(latitude, longitude) =>
              onChange(
                points.map((item, n) =>
                  n === i
                    ? {
                        ...item,
                        latitude: String(latitude),
                        longitude: String(longitude),
                      }
                    : item,
                ),
              )
            }
          />
          <button
            type="button"
            onClick={() => onChange(points.filter((_, n) => n !== i))}
          >
            Remove access point {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={points.length >= 12}
        onClick={() =>
          onChange([
            ...points,
            {
              name: "",
              type: "Drop-off",
              latitude: "",
              longitude: "",
              directions: "",
            },
          ])
        }
      >
        Add access point
      </button>
    </section>
  );
}
