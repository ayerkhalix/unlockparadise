"use client";
import { stopTimeLabel, type StopTime } from "@/lib/planning";
export function StopTimeFields({
  value,
  onChange,
}: {
  value: StopTime;
  onChange: (value: StopTime) => void;
}) {
  return (
    <fieldset className="p3-stop-time-fields">
      <legend>
        Visit time <span className="p2-muted">(optional)</span>
      </legend>
      <div className="p3-time-pair">
        <label>
          Start time
          <input
            type="time"
            step="60"
            value={value.start_time || ""}
            required={Boolean(value.end_time)}
            onChange={(e) =>
              onChange({ ...value, start_time: e.target.value || null })
            }
          />
        </label>
        <label>
          End time
          <input
            type="time"
            step="60"
            min={value.start_time || undefined}
            value={value.end_time || ""}
            required={Boolean(value.start_time)}
            ref={(el) => {
              el?.setCustomValidity(
                value.start_time &&
                  value.end_time &&
                  value.end_time <= value.start_time
                  ? "End time must be after start time on the same day."
                  : "",
              );
            }}
            onChange={(e) =>
              onChange({ ...value, end_time: e.target.value || null })
            }
          />
        </label>
      </div>
      <p className="p3-time-preview">
        {value.start_time && value.end_time && value.end_time > value.start_time
          ? stopTimeLabel(value.start_time, value.end_time)
          : "Leave both blank for a flexible stop. Times are local to Palawan."}
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
