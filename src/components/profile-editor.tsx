"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./ui/modal";
import { useDecision } from "./ui/decision";
import { ValidatedForm } from "./ui/validated-form";
import { AvatarForm } from "./profile-photo";
import {
  interests,
  paces,
  styles,
  companions,
  emptyAnswers,
  type TravelPreferences,
  type TravelAnswers,
} from "@/lib/traveler";
import { requestJSON, notify } from "@/lib/client-api";

export function ProfileEditor({
  name,
  photoId,
  preferences,
}: {
  name: string;
  photoId?: string;
  preferences: TravelPreferences | null;
}) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useDecision();
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <>
      {dialog}
      <button
        className="p2-button p2-button--quiet"
        type="button"
        onClick={() => setOpen(true)}
      >
        Edit profile
      </button>
      {open && (
        <Modal
          title="Edit profile"
          onClose={async () => {
            if (
              !busy &&
              (!dirty || (await ask("Discard unsaved profile changes?")))
            ) {
              setOpen(false);
              setDirty(false);
            }
          }}
        >
          <ProfileFields
            name={name}
            photoId={photoId}
            preferences={preferences}
            onDirty={setDirty}
            onBusy={setBusy}
          />
        </Modal>
      )}
    </>
  );
}
function ProfileFields({
  name,
  photoId,
  preferences,
  onDirty,
  onBusy,
}: {
  name: string;
  photoId?: string;
  preferences: TravelPreferences | null;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(name),
    [savedName, setSavedName] = useState(name);
  const [answers, setAnswers] = useState<TravelAnswers>(
    preferences
      ? {
          interests: preferences.interests,
          pace: preferences.pace,
          style: preferences.style,
          companion: preferences.companion,
          public_badges: preferences.public_badges,
        }
      : emptyAnswers,
  );
  const [savedAnswers, setSavedAnswers] = useState(JSON.stringify(answers));
  const [version, setVersion] = useState(preferences?.version || 0);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    scope: "name" | "preferences";
    message: string;
  } | null>(null);
  const { ask, dialog } = useDecision();
  const pending = useRef(false);
  useEffect(
    () =>
      onDirty(
        value !== savedName ||
          JSON.stringify(answers) !== savedAnswers ||
          photoDirty,
      ),
    [value, savedName, answers, savedAnswers, photoDirty, onDirty],
  );
  const acquire = () => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    return true;
  };
  const release = () => {
    pending.current = false;
    setBusy(false);
    onBusy(false);
  };
  const save = async (
    scope: "name" | "preferences",
    action: () => Promise<void>,
  ) => {
    if (!acquire()) return;
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError({ scope, message: (e as Error).message });
    } finally {
      release();
    }
  };
  return (
    <div className="profile-edit-fields">
      {dialog}
      <section>
        <h3>Display name</h3>
        <ValidatedForm
          className="p2-form"
          data-backend="true"
          onSubmit={(e) => {
            e.preventDefault();
            void save("name", async () => {
              await requestJSON("/api/v1/me/", "PATCH", {
                display_name: value,
              });
              setSavedName(value);
              notify("Display name saved.");
            });
          }}
        >
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            name="display_name"
            required
            minLength={2}
            maxLength={40}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="p2-button" disabled={busy || value === savedName}>
            Save name
          </button>
        </ValidatedForm>
        {error?.scope === "name" && (
          <p className="p2-error" role="alert">
            {error.message} Your unsaved name is still here.
          </p>
        )}
      </section>
      <section>
        <h3>Profile photo</h3>
        <AvatarForm
          photoId={photoId}
          inline
          disabled={busy}
          beforeStart={acquire}
          onDirtyChange={setPhotoDirty}
          onBusyChange={(value) => {
            if (!value) release();
          }}
        />
      </section>
      <section>
        <h3>Travel preferences</h3>
        <ValidatedForm
          className="p2-form"
          data-backend="true"
          onSubmit={(e) => {
            e.preventDefault();
            void save("preferences", async () => {
              const result = await requestJSON<{ data: TravelPreferences }>(
                "/api/v1/traveler/",
                "PUT",
                { op: "complete", version, answers },
              );
              setVersion(result.data.version);
              setSavedAnswers(JSON.stringify(answers));
              notify("Travel preferences saved.");
            });
          }}
        >
          <fieldset disabled={busy} className="p2-fieldset">
            <legend>What do you like?</legend>
            <div className="profile-interest-options">
              {interests.map((interest) => (
                <label key={interest.key}>
                  <input
                    type="checkbox"
                    checked={answers.interests.includes(interest.key)}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        interests: e.target.checked
                          ? [...answers.interests, interest.key]
                          : answers.interests.filter(
                              (key) => key !== interest.key,
                            ),
                      })
                    }
                  />
                  {interest.label}
                </label>
              ))}
            </div>
            {(
              [
                { key: "pace", label: "Travel pace", options: paces },
                { key: "style", label: "Travel style", options: styles },
                {
                  key: "companion",
                  label: "Usual company",
                  options: companions,
                },
              ] as const
            ).map(({ key, label, options }) => (
              <label key={key}>
                {label}
                <select
                  value={answers[key] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [key]: e.target.value || null })
                  }
                >
                  <option value="">No preference</option>
                  {options.map((option) => (
                    <option value={option.key} key={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <button
            className="p2-button"
            disabled={busy || JSON.stringify(answers) === savedAnswers}
          >
            Save preferences
          </button>
          <p className="p2-muted">
            Traveler badge visibility is in Account settings.
          </p>
        </ValidatedForm>
        {error?.scope === "preferences" && (
          <div className="p2-error" role="alert">
            <p>{error.message} Your unsaved preferences are still here.</p>
            <button
              type="button"
              className="p2-button p2-button--quiet"
              disabled={busy}
              onClick={async () => {
                if (
                  await ask(
                    "Reload saved preferences and discard your preference changes?",
                  )
                ) {
                  void save("preferences", async () => {
                    const result = await requestJSON<{
                      data: TravelPreferences | null;
                    }>("/api/v1/traveler/");
                    const current = result.data;
                    const restored: TravelAnswers = current
                      ? {
                          interests: current.interests,
                          pace: current.pace,
                          style: current.style,
                          companion: current.companion,
                          public_badges: current.public_badges,
                        }
                      : emptyAnswers;
                    setAnswers(restored);
                    setSavedAnswers(JSON.stringify(restored));
                    setVersion(current?.version || 0);
                  });
                }
              }}
            >
              Reload saved preferences
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
