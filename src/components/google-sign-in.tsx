"use client";
import { useEffect, useRef, useState } from "react";

export function GoogleSignIn({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function start() {
    if (busy || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/google/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect_to: next }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Google sign-in could not start. Please try again.",
        );
      location.assign(result.redirect_to);
    } catch (error) {
      if (controller.signal.aborted) return;
      setError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Google sign-in could not start. Please try again.",
      );
      setBusy(false);
    } finally {
      active.current = null;
    }
  }
  return (
    <div className="p2-google-auth">
      <div className="p2-auth-divider">
        <span>or</span>
      </div>
      <button
        type="button"
        className="p2-google-button"
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        aria-describedby={error ? "google-error" : undefined}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.17 7.09-10.32 7.09-17.65Z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19Z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
          />
        </svg>
        <span className="p2-google-button__labels">
          <span style={{ visibility: busy ? "hidden" : "visible" }}>
            Continue with Google
          </span>
          {busy && (
            <span className="p2-google-button__pending">Connecting…</span>
          )}
        </span>
      </button>
      {error && (
        <p id="google-error" className="p2-auth-status" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
