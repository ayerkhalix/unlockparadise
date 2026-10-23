"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  answersSchema,
  archetypes,
  companions,
  emptyAnswers,
  interests,
  paces,
  styles,
  travelerReason,
  type TravelAnswers,
  type TravelPreferences,
} from "@/lib/traveler";
import { requestJSON } from "@/lib/client-api";
import { TravelerTitle } from "./traveler-title";
import { Icon } from "./icon";
import { TravelerBadges } from "./traveler-identity";
import { ValidatedForm } from "./ui/validated-form";
import { useDecision } from "./ui/decision";

const steps = [
  {
    label: "Interests",
    title: "What would you like to explore?",
    subtitle: "Pick as many as you like.",
  },
  {
    label: "Pace",
    title: "What’s your kind of perfect day?",
    subtitle: "There’s no rush. Find your own rhythm.",
  },
  {
    label: "Style",
    title: "What makes a trip memorable for you?",
    subtitle: "Choose the one that feels most like you.",
  },
  {
    label: "Companions",
    title: "Who do you usually explore with?",
    subtitle: "A little about your usual company. All answers are optional.",
  },
];
export function TravelerDiscovery({
  userId,
  initial,
  destination,
  image,
}: {
  userId: string;
  initial: TravelPreferences | null;
  destination: string;
  image?: string;
}) {
  const router = useRouter();
  const editing = initial?.status === "completed";
  const [answers, setAnswers] = useState<TravelAnswers>(
    initial
      ? {
          interests: initial.interests,
          pace: initial.pace,
          style: initial.style,
          companion: initial.companion,
          public_badges: initial.public_badges,
        }
      : emptyAnswers,
  );
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [result, setResult] = useState<TravelPreferences | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const { ask, dialog } = useDecision();
  const storageKey = `upd-traveler-draft-v2:${userId}`;
  const version = initial?.version || 0;
  useEffect(() => {
    // Resolve browser-only draft storage after hydration, before showing inputs.
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const draft = JSON.parse(raw);
          const parsed = answersSchema.safeParse(draft.answers);
          if (
            parsed.success &&
            draft.version === version &&
            Number.isFinite(draft.at) &&
            draft.at <= Date.now() &&
            Date.now() - draft.at < 86400000 &&
            Number.isInteger(draft.step) &&
            draft.step >= 0 &&
            draft.step < 4
          ) {
            setAnswers(parsed.data);
            setStep(draft.step);
          } else sessionStorage.removeItem(storageKey);
        }
      } catch {
        setStorageError(true);
      }
      setRestored(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, version]);
  useEffect(() => {
    if (!restored || result) return;
    let frame = 0;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ version, at: Date.now(), step, answers }),
      );
    } catch {
      frame = requestAnimationFrame(() => setStorageError(true));
    }
    return () => cancelAnimationFrame(frame);
  }, [answers, step, restored, result, storageKey, version]);
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());
  const move = (next: number) => {
    setStep(next);
    setError("");
    focusHeading();
  };
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage is optional, never a commit boundary. */
    }
  };
  const save = async (op: "complete" | "skip" | "clear") => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await requestJSON<{ data: TravelPreferences }>(
        "/api/v1/traveler/",
        "PUT",
        { op, version, ...(op === "complete" ? { answers } : {}) },
      );
      clearDraft();
      if (op === "complete") {
        setResult(response.data);
        focusHeading();
        router.refresh();
      } else {
        router.push(destination);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (
      JSON.stringify(answers) !==
        JSON.stringify(
          initial && {
            interests: initial.interests,
            pace: initial.pace,
            style: initial.style,
            companion: initial.companion,
            public_badges: initial.public_badges,
          },
        ) &&
      !(await ask(
        "Discard these travel preference changes? Your saved preferences will stay as they are.",
      ))
    )
      return;
    clearDraft();
    router.push(destination);
  };
  if (result) {
    const identity =
      archetypes[result.archetype] || archetypes["curious-explorer"];
    return (
      <main id="upd-main" className="upd-main td-page">
        <div className="td-result">
          <Icon name={identity.icon} size={64} />
          <h1 ref={heading} tabIndex={-1}>
            <TravelerTitle selected={result.interests}>
              {identity.label}
            </TravelerTitle>
          </h1>
          <p className="td-lead">{identity.description}</p>
          <TravelerBadges identity={result} />
          <p>{travelerReason(result)}</p>
          <p className="td-caption">
            A playful reflection of your preferences, always yours to change.
          </p>
          <p className="td-caption">
            {result.public_badges
              ? "You chose to show badges on approved public reviews."
              : "Your badges stay private. You can change this in your account."}
          </p>
          <div className="p2-actions">
            <a className="p2-button" href="/">
              Explore my picks
            </a>
            <a className="p2-button p2-button--quiet" href="/account/">
              View my traveler identity
            </a>
          </div>
        </div>
      </main>
    );
  }
  const question = steps[step];
  return (
    <main id="upd-main" className="upd-main td-page">
      <div className="td-discovery">
        <div className="td-discovery__body">
          <div className="td-progress">
            <p aria-live="polite">
              {step + 1} of 4 · {question.label}
            </p>
            <ol aria-label="Traveler discovery progress">
              {steps.map((item, index) => (
                <li
                  key={item.label}
                  aria-current={step === index ? "step" : undefined}
                  className={index <= step ? "is-reached" : ""}
                >
                  <span className="screen-reader-text">
                    {item.label}
                    {index < step ? ", completed" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <h1 ref={heading} tabIndex={-1}>
            {question.title}
          </h1>
          <p className="td-lead">{question.subtitle}</p>
          {!restored ? (
            <p role="status">Loading your progress…</p>
          ) : (
            <ValidatedForm
              className="td-form"
              data-backend="true"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 3) move(step + 1);
                else void save("complete");
              }}
            >
              <fieldset disabled={busy}>
                <legend className="screen-reader-text">{question.title}</legend>
                {step === 0 ? (
                  <div className="td-choices td-choices--interests">
                    {interests.map((item) => (
                      <label key={item.key} className="td-choice">
                        <input
                          type="checkbox"
                          checked={answers.interests.includes(item.key)}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              interests: e.target.checked
                                ? [...a.interests, item.key]
                                : a.interests.filter((k) => k !== item.key),
                            }))
                          }
                        />
                        <Icon name={item.icon} size={26} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <span className="td-choice__check" aria-hidden="true">
                          <svg
                            viewBox="0 0 16 16"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="m3 8 3 3 7-7" />
                          </svg>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : step === 3 ? (
                  <div className="td-choices td-choices--companions">
                    {companions.map((item) => (
                      <label key={item.key} className="td-choice">
                        <input
                          type="radio"
                          name="companion"
                          checked={answers.companion === item.key}
                          onChange={() =>
                            setAnswers((a) => ({ ...a, companion: item.key }))
                          }
                        />
                        <span>
                          <strong>{item.label}</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="td-choices td-choices--single">
                    {(step === 1 ? paces : styles).map((item) => (
                      <label key={item.key} className="td-choice">
                        <input
                          type="radio"
                          name={step === 1 ? "pace" : "style"}
                          checked={
                            answers[step === 1 ? "pace" : "style"] === item.key
                          }
                          onChange={() =>
                            setAnswers((a) =>
                              step === 1
                                ? {
                                    ...a,
                                    pace: item.key as TravelAnswers["pace"],
                                  }
                                : {
                                    ...a,
                                    style: item.key as TravelAnswers["style"],
                                  },
                            )
                          }
                        />
                        <Icon name={item.icon} size={26} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {step > 0 && (
                  <button
                    type="button"
                    className="td-text-button"
                    onClick={() =>
                      setAnswers((a) => ({
                        ...a,
                        [step === 1
                          ? "pace"
                          : step === 2
                            ? "style"
                            : "companion"]: null,
                      }))
                    }
                  >
                    Clear this answer
                  </button>
                )}
                {step === 1 && (
                  <p className="td-caption">
                    We use pace only where recorded travel details support it.
                    It isn’t a difficulty or safety rating.
                  </p>
                )}
                {step === 3 && (
                  <>
                    <label className="td-sharing">
                      <input
                        type="checkbox"
                        checked={answers.public_badges}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            public_badges: e.target.checked,
                          }))
                        }
                      />
                      <span>
                        <strong>
                          Show my traveler badges on public reviews
                        </strong>
                        <small>
                          Share only your traveler type and up to two interests.
                          Your pace, travel style and companions stay private.
                          Turn this off any time.
                        </small>
                      </span>
                    </label>
                    <p className="td-caption">
                      Companions are a preference, not a destination suitability
                      recommendation.
                    </p>
                  </>
                )}
              </fieldset>
              {error && (
                <div className="p2-error" role="alert">
                  <p>{error} Your answers are still here.</p>
                  <button
                    type="button"
                    className="p2-button p2-button--quiet"
                    onClick={async () => {
                      if (
                        await ask(
                          "Reload saved preferences and discard the answers in this draft?",
                        )
                      ) {
                        clearDraft();
                        window.location.reload();
                      }
                    }}
                  >
                    Reload saved preferences
                  </button>
                  <a href="/login/?redirect_to=%2Ftraveler-discovery%2F">
                    Sign in again
                  </a>
                </div>
              )}
              <div className="td-form__actions">
                <button
                  type="button"
                  className="p2-button p2-button--quiet"
                  disabled={busy || step === 0}
                  onClick={() => move(step - 1)}
                >
                  Back
                </button>
                <button className="p2-button" type="submit" disabled={busy}>
                  {busy
                    ? "Saving preferences…"
                    : step === 3
                      ? "Find my traveler type"
                      : "Continue"}
                </button>
              </div>
              <div className="td-form__aside">
                <button
                  type="button"
                  className="td-text-button"
                  disabled={busy}
                  onClick={() => (editing ? void cancel() : void save("skip"))}
                >
                  {editing ? "Cancel editing" : "Skip for now"}
                </button>
                <p className="td-caption">
                  {storageError
                    ? "This browser can’t keep a draft. Stay in this tab until you save."
                    : "Progress stays in this tab for up to 24 hours."}
                </p>
              </div>
              {editing && (
                <button
                  type="button"
                  className="td-text-button td-clear"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await ask(
                        "Clear your travel preferences and remove public badges from your reviews?",
                      )
                    )
                      void save("clear");
                  }}
                >
                  Clear all travel preferences
                </button>
              )}
            </ValidatedForm>
          )}
        </div>
        {image && (
          <aside className="td-discovery__photo">
            <div
              style={{ backgroundImage: `url('${image}')` }}
              role="img"
              aria-label="Destination photograph from the Palawan collection"
            />
            <p>
              Your next Palawan chapter
              <br />
              <strong>Starts with you.</strong>
            </p>
          </aside>
        )}
      </div>
      {dialog}
    </main>
  );
}
