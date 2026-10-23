"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJSON } from "@/lib/client-api";
export function TravelerInvitation({ version = 0 }: { version?: number }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  if (hidden) return null;
  return (
    <section
      className="td-invitation"
      aria-label="Traveler discovery invitation"
    >
      <div>
        <h2>Discover your traveler type</h2>
        <p>A few choices. Places that feel more like you.</p>
      </div>
      <div className="p2-actions">
        <a className="p2-button" href="/traveler-discovery/">
          Discover my travel style
        </a>
        <button
          type="button"
          disabled={busy}
          className="p2-button p2-button--quiet"
          onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError("");
            try {
              await requestJSON("/api/v1/traveler/", "PUT", {
                op: "dismiss",
                version,
              });
              setHidden(true);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? "Dismissing…" : "Not now"}
        </button>
      </div>
      {error && (
        <p role="alert" className="p2-error">
          {error} Your invitation is still available; try again.
        </p>
      )}
    </section>
  );
}
