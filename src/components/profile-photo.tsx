"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AvatarForm({
  photoId,
  inline = false,
  onDirtyChange,
  onBusyChange,
  disabled = false,
  beforeStart,
}: {
  photoId?: string;
  inline?: boolean;
  onDirtyChange?: (value: boolean) => void;
  onBusyChange?: (value: boolean) => void;
  disabled?: boolean;
  beforeStart?: () => boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const working = (value: boolean) => {
    setBusy(value);
    onBusyChange?.(value);
  };
  return (
    <div className={inline ? "profile-photo-fields" : "profile-photo-editor"}>
      {photoId && (
        <img
          src={`/api/media/${photoId}/`}
          alt="Current profile photo"
          width={64}
          height={64}
        />
      )}
      <ValidatedForm
        className="p2-form"
        data-backend="true"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || disabled || (beforeStart && !beforeStart())) return;
          working(true);
          setMessage("");
          const form = e.currentTarget;
          try {
            const r = await fetch("/api/profile/photo/", {
              method: "POST",
              body: new FormData(form),
            });
            const result = await r.json();
            if (!r.ok) throw new Error(result.error);
            setMessage(result.message || "Photo saved.");
            form.reset();
            onDirtyChange?.(false);
            router.refresh();
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            working(false);
          }
        }}
      >
        <label>
          Choose a photo
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={busy || disabled}
            onChange={(e) => onDirtyChange?.(!!e.target.files?.length)}
          />
        </label>
        <p className="p2-muted">
          JPG, PNG or WebP, up to 8 MB. We crop it square for you.
        </p>
        <button className="p2-button" disabled={busy || disabled}>
          Upload photo
        </button>
      </ValidatedForm>
      {photoId && (
        <button
          className="p2-back"
          type="button"
          disabled={busy || disabled}
          onClick={async () => {
            if (busy || disabled || (beforeStart && !beforeStart())) return;
            working(true);
            try {
              const r = await fetch("/api/profile/photo/", {
                method: "DELETE",
              });
              if (!r.ok) throw new Error((await r.json()).error);
              setMessage("Photo removed.");
              router.refresh();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              working(false);
            }
          }}
        >
          Remove photo
        </button>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
