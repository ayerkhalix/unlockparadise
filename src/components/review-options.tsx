"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { Modal } from "./ui/modal";
import { useDecision } from "./ui/decision";
import { ReviewForm, type ReviewEdit } from "./place-actions";
import { notify, requestJSON } from "@/lib/client-api";

export function ReviewOptions({ review }: { review: ReviewEdit }) {
  const menu = useRef<HTMLDetailsElement>(null),
    trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<ReviewEdit | null>(null);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const { ask, dialog } = useDecision();
  const router = useRouter();
  const closeMenu = () => {
    if (menu.current) menu.current.open = false;
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        if (menu.current) menu.current.open = false;
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (menu.current) menu.current.open = false;
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const closeEditor = async () => {
    if (busy) return;
    if (dirty && !(await ask("Discard your review changes?"))) return;
    setEditing(null);
    setDirty(false);
  };
  return (
    <>
      <details
        className="review-options"
        ref={menu}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary
          ref={trigger}
          aria-label="Review options"
          aria-disabled={busy}
          onClick={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Icon name="More" size={22} />
        </summary>
        <div
          className="review-options__panel"
          role="group"
          aria-label="Manage your review"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              closeMenu();
              setDirty(false);
              setMessage("");
              const body =
                new DOMParser()
                  .parseFromString(
                    review.body
                      .replace(/<br\s*\/?>/gi, "\n")
                      .replace(/<\/p>/gi, "\n"),
                    "text/html",
                  )
                  .body.textContent?.trim() || "";
              setEditing({ ...review, body });
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="review-options__delete"
            disabled={busy}
            onClick={async () => {
              closeMenu();
              setMessage("");
              if (
                !(await ask(
                  "Delete your review? You can write a new one afterwards.",
                ))
              )
                return;
              setBusy(true);
              try {
                await requestJSON(`/api/v1/reviews/${review.id}/`, "DELETE");
                notify("Review deleted.");
                router.refresh();
              } catch (error) {
                setMessage((error as Error).message);
                notify((error as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </button>
        </div>
      </details>
      {message && (
        <p className="review-options__error" role="status">
          {message}
        </p>
      )}
      {editing && (
        <Modal
          title="Edit review"
          onClose={() => void closeEditor()}
          returnFocusRef={trigger}
        >
          <ReviewForm
            review={editing}
            onDirtyChange={() => setDirty(true)}
            onBusyChange={setBusy}
            onCancel={() => void closeEditor()}
            onSaved={(message) => {
              setDirty(false);
              setEditing(null);
              notify(message);
            }}
          />
        </Modal>
      )}
      {dialog}
    </>
  );
}
