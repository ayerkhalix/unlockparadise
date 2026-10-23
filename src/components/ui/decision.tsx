"use client";
import { useRef, useState } from "react";
import { Modal } from "./modal";
import { ValidatedForm } from "./validated-form";
type Decision = {
  title: string;
  initial?: string;
  resolve: (value: string | null) => void;
};
export function useDecision() {
  const [decision, setDecision] = useState<Decision | null>(null);
  const pending = useRef(false);
  const ask = (title: string, initial?: string): Promise<string | null> => {
    if (pending.current) return Promise.resolve(null);
    pending.current = true;
    return new Promise((resolve) => setDecision({ title, initial, resolve }));
  };
  const finish = (value: string | null) => {
    decision?.resolve(value);
    pending.current = false;
    setDecision(null);
  };
  const dialog = decision && (
    <Modal
      title={
        decision.title.startsWith("Delete ")
          ? "Confirm deletion"
          : decision.initial === undefined
            ? "Confirm action"
            : "Edit value"
      }
      onClose={() => finish(null)}
    >
      <p>{decision.title}</p>
      <ValidatedForm
        className="p2-form"
        data-backend="true"
        onSubmit={(e) => {
          e.preventDefault();
          finish(
            decision.initial === undefined
              ? "confirmed"
              : String(new FormData(e.currentTarget).get("value") || ""),
          );
        }}
      >
        {decision.initial !== undefined && (
          <label>
            {decision.title.startsWith("Delete ") ? "Confirmation" : "Value"}
            <textarea
              className="resize-none"
              name="value"
              rows={5}
              defaultValue={decision.initial}
            />
          </label>
        )}
        <div className="p2-actions">
          <button
            data-initial-focus
            type="button"
            className="p2-button p2-button--quiet"
            onClick={() => finish(null)}
          >
            Cancel
          </button>
          <button type="submit" className="p2-button">
            {decision.initial === undefined ||
            decision.title.startsWith("Delete ")
              ? decision.title.match(
                  /^(Delete|Remove|Revoke|Change|Clear|Discard|Archive|Publish|Hide|Grant|Save|Return)\b/,
                )?.[0] || "Confirm"
              : "Save value"}
          </button>
        </div>
      </ValidatedForm>
    </Modal>
  );
  return { ask, dialog };
}
