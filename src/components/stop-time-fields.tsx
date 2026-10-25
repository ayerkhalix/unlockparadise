"use client";
import { useEffect, useId, useRef } from "react";
import { stopTimeLabel, type StopTime } from "@/lib/planning";
import { clearValidFieldError } from "@/lib/form-validation";

/** Keep complete HH:mm values while the OS owns each select's keyboard/picker. */
function ClockFields({
  label,
  value,
  required,
  error,
  onChange,
}: {
  label: "Start" | "End";
  value: string | null;
  required: boolean;
  error?: string;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  const hourField = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (hourField.current) clearValidFieldError(hourField.current);
  }, [value, required, error]);
  const hour24 = value ? Number(value.slice(0, 2)) : 0;
  const hour = value ? String(hour24 % 12 || 12) : "";
  const minute = value?.slice(3, 5) || "00";
  const period = hour24 >= 12 ? "PM" : "AM";
  const change = (nextHour: string, nextMinute: string, nextPeriod: string) => {
    onChange(
      nextHour
        ? `${String((Number(nextHour) % 12) + (nextPeriod === "PM" ? 12 : 0)).padStart(2, "0")}:${nextMinute}`
        : null,
    );
  };
  return (
    <fieldset className="p3-clock-field">
      <legend>{label} time</legend>
      <div className="p3-clock-parts">
        <label htmlFor={`${id}-hour`}>
          Hour
          <select
            id={`${id}-hour`}
            aria-label={`${label} hour`}
            value={hour}
            required={required}
            ref={(element) => {
              hourField.current = element;
              element?.setCustomValidity(error || "");
            }}
            onChange={(event) => change(event.target.value, minute, period)}
          >
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-minute`}>
          Minute
          <select
            id={`${id}-minute`}
            aria-label={`${label} minute`}
            value={minute}
            disabled={!value}
            onChange={(event) => change(hour, event.target.value, period)}
          >
            {Array.from({ length: 60 }, (_, index) => {
              const minutes = String(index).padStart(2, "0");
              return (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              );
            })}
          </select>
        </label>
        <label htmlFor={`${id}-period`}>
          AM/PM
          <select
            id={`${id}-period`}
            aria-label={`${label} AM/PM`}
            value={period}
            disabled={!value}
            onChange={(event) => change(hour, minute, event.target.value)}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}

export function StopTimeFields({
  value,
  onChange,
}: {
  value: StopTime;
  onChange: (value: StopTime) => void;
}) {
  const invalidRange = Boolean(
    value.start_time && value.end_time && value.end_time <= value.start_time,
  );
  const error = invalidRange
    ? "End time must be after start time on the same day."
    : undefined;
  const preview =
    error ||
    (value.start_time && value.end_time
      ? stopTimeLabel(value.start_time, value.end_time)
      : value.start_time || value.end_time
        ? "Choose both start and end times, or clear times for a flexible stop."
        : "Choose an hour, then minutes and AM/PM. Times are local to Palawan.");
  return (
    <fieldset className="p3-stop-time-fields">
      <legend>
        Visit time <span className="p2-muted">(optional)</span>
      </legend>
      <div className="p3-time-pair">
        <ClockFields
          label="Start"
          value={value.start_time}
          required={Boolean(value.end_time)}
          onChange={(start_time) => onChange({ ...value, start_time })}
        />
        <ClockFields
          label="End"
          value={value.end_time}
          required={Boolean(value.start_time)}
          error={error}
          onChange={(end_time) => onChange({ ...value, end_time })}
        />
      </div>
      <p className="p3-time-preview" aria-live="polite">
        {preview}
      </p>
      {(value.start_time || value.end_time) && (
        <button
          type="button"
          className="p2-button p2-button--quiet"
          onClick={() => onChange({ start_time: null, end_time: null })}
        >
          Clear times
        </button>
      )}
    </fieldset>
  );
}
