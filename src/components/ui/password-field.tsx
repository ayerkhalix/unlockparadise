"use client";
import { useState, type ComponentProps } from "react";

/** React-owned forms must not be reparented by the static password enhancer. */
export function PasswordField(props: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  const subject =
    props.name === "current_password" ? "current password" : "password";
  const action = `${shown ? "Hide" : "Show"} ${subject}`;
  return (
    <span className="p2-password-field" data-react-password="true">
      <input {...props} type={shown ? "text" : "password"} />
      <button
        type="button"
        className="p2-password-toggle"
        aria-label={action}
        data-tooltip={action}
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </span>
  );
}
