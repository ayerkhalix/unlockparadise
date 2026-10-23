"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJSON } from "@/lib/client-api";
import type { TravelPreferences } from "@/lib/traveler";
import { ValidatedForm } from "./ui/validated-form";
export function TravelerBadgePrivacy({
  initial,
}: {
  initial: TravelPreferences;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(initial);
  const [checked, setChecked] = useState(initial.public_badges);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const change = async (visible: boolean) => {
    if (pending.current) return;
    pending.current = true;
    setChecked(visible);
    setBusy(true);
    setError("");
    try {
      const response = await requestJSON<{ data: TravelPreferences }>(
        "/api/v1/traveler/",
        "PUT",
        {
          op: "complete",
          version: preferences.version,
          answers: {
            interests: preferences.interests,
            pace: preferences.pace,
            style: preferences.style,
            companion: preferences.companion,
            public_badges: visible,
          },
        },
      );
      setPreferences(response.data);
      setChecked(response.data.public_badges);
      router.refresh();
    } catch (e) {
      setChecked(preferences.public_badges);
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <ValidatedForm
      className="td-privacy"
      aria-busy={busy}
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="td-sharing">
        <input
          type="checkbox"
          disabled={busy}
          checked={checked}
          onChange={(e) => void change(e.target.checked)}
        />
        <span>
          <strong>Show my traveler badges on public reviews</strong>
          <small>
            Your traveler type and up to two relevant interests. Your other
            answers stay private.
          </small>
        </span>
      </label>
      <p className="td-caption" role="status">
        {busy
          ? "Saving badge visibility…"
          : preferences.public_badges
            ? "Your badges appear on approved, accessible reviews."
            : "Your traveler badges are private."}
      </p>
      {error && (
        <p className="p2-error" role="alert">
          {error} Your previous sharing choice is unchanged.{" "}
          <a href="/account/">Reload your account</a> before trying again.
        </p>
      )}
    </ValidatedForm>
  );
}
