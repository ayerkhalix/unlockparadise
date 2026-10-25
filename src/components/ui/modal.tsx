"use client";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAdminTheme } from "../admin-theme";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function Modal({
  title,
  heading,
  onClose,
  children,
  drawer = false,
  side = "right",
}: {
  title: string;
  heading?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  drawer?: boolean;
  side?: "left" | "right";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const theme = useAdminTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const id = useId();
  useEffect(() => {
    if (!mounted) return;
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      data-admin-theme={theme?.theme}
      className={`p2-modal${drawer ? ` p2-modal--drawer p2-modal--${side}` : ""}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="p2-modal__head">
        <h2 id={id}>{heading || title}</h2>
        <button
          type="button"
          className="p2-icon"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="p2-modal__body">{children}</div>
    </dialog>,
    document.body,
  );
}
