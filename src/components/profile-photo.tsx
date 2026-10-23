"use client";
import { ValidatedForm } from "./ui/validated-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { Modal } from "./ui/modal";
export function AvatarForm({ photoId }: { photoId?: string }) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function remove() {
    setBusy(true);
    try {
      const r = await fetch("/api/profile/photo/", { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
      router.refresh();
      setMessage("Photo removed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="upd-profile__avatarbtn"
        type="button"
        aria-expanded={open}
        aria-label="Change profile photo"
        onClick={() => setOpen(!open)}
      >
        {photoId ? (
          <img
            src={`/api/media/${photoId}/`}
            alt="Your profile"
            width={104}
            height={104}
          />
        ) : (
          <Icon name="Person" size={64} />
        )}
      </button>
      {open && (
        <Modal title="Profile photo" onClose={() => setOpen(false)}>
          <ValidatedForm
            className="upd-auth-form"
            data-backend="true"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const data = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/profile/photo/", {
                  method: "POST",
                  body: data,
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.error);
                setMessage(result.message);
                router.refresh();
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="upd-auth-field">
              Choose a photo
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <p className="upd-avatar-hint">
              JPG, PNG or WebP, up to 8 MB. We crop it square for you.
            </p>
            <button className="upd-btn upd-btn--primary" disabled={busy}>
              Upload photo
            </button>
          </ValidatedForm>
          {photoId && (
            <button
              className="upd-btn upd-btn--ghost"
              disabled={busy}
              onClick={remove}
            >
              Remove photo
            </button>
          )}
          <p role="status">{message}</p>
        </Modal>
      )}
    </>
  );
}
