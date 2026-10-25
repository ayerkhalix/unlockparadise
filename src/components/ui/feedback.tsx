"use client";
import { useEffect, useState } from "react";
import type { NoticeAction } from "@/lib/client-api";
type Notice = {
  id: string;
  message: string;
  error: boolean;
  action?: NoticeAction;
};
function NoticeItem({
  notice,
  dismiss,
}: {
  notice: Notice;
  dismiss: () => void;
}) {
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false),
    [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    change();
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (notice.error || failure || hover || focus || hidden || busy) return;
    const timer = setTimeout(dismiss, notice.action ? 15000 : 7000);
    return () => clearTimeout(timer);
  }, [notice, failure, hover, focus, hidden, busy, dismiss]);
  return (
    <div
      className={`p2-notice${notice.error || failure ? " p2-notice--error" : ""}`}
      role={notice.error || failure ? "alert" : "status"}
      aria-atomic="true"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false);
      }}
    >
      <span>{failure || notice.message}</span>
      {notice.action && (
        <button
          type="button"
          className="p2-notice-undo"
          aria-label={
            busy
              ? "Restoring removed item"
              : failure
                ? "Retry Undo removal"
                : "Undo removal"
          }
          disabled={busy}
          aria-busy={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setFailure("");
            try {
              await notice.action!.run();
              dismiss();
            } catch (error) {
              setFailure(
                (error as Error).message ||
                  "Could not restore this item. Try Undo again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Restoring…" : failure ? "Retry Undo" : notice.action.label}
        </button>
      )}
      <button
        type="button"
        className="p2-icon"
        aria-label="Dismiss notification"
        disabled={busy}
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
}
export function Feedback() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Notice, "id">>).detail;
      setNotices((current) =>
        [
          ...current.filter((item) => item.action || item.error),
          { ...detail, id: crypto.randomUUID() },
        ].slice(-5),
      );
    };
    window.addEventListener("upd:notice", show);
    return () => {
      window.removeEventListener("upd:notice", show);
    };
  }, []);
  return (
    <div className="p2-notices" role="region" aria-label="Notifications">
      {notices.map((notice) => (
        <NoticeItem
          key={notice.id}
          notice={notice}
          dismiss={() =>
            setNotices((current) =>
              current.filter((item) => item.id !== notice.id),
            )
          }
        />
      ))}
    </div>
  );
}
// One delegated tooltip supports retained fragments and React controls.
export function Tooltips() {
  useEffect(() => {
    document.documentElement.dataset.updReady = "true";
    const tip = document.createElement("div");
    tip.id = "upd-tooltip";
    tip.role = "tooltip";
    tip.className = "p2-tooltip";
    tip.hidden = true;
    const help = document.createElement("div");
    help.setAttribute("role", "region");
    help.setAttribute("aria-label", "Context help");
    help.hidden = true;
    document.body.appendChild(help);
    let target: HTMLElement | null = null,
      oldDescription: string | null = null,
      timer: ReturnType<typeof setTimeout>,
      hideTimer: ReturnType<typeof setTimeout>;
    const hide = () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
      tip.hidden = true;
      help.hidden = true;
      if (target) {
        if (oldDescription)
          target.setAttribute("aria-describedby", oldDescription);
        else target.removeAttribute("aria-describedby");
      }
      target = null;
    };
    const show = (element: HTMLElement, delay = 300) => {
      clearTimeout(hideTimer);
      if (target === element && !tip.hidden) return;
      hide();
      const label =
        element.dataset.tooltip ||
        element.dataset.tip ||
        element.getAttribute("aria-label");
      if (!label) return;
      target = element;
      oldDescription = element.getAttribute("aria-describedby");
      timer = setTimeout(() => {
        if (!element.isConnected) return;
        const host = element.closest("dialog[open]") || help;
        help.hidden = host !== help;
        const theme =
          element.closest<HTMLElement>("[data-admin-theme]")?.dataset
            .adminTheme;
        if (theme) tip.dataset.adminTheme = theme;
        else delete tip.dataset.adminTheme;
        host.appendChild(tip);
        tip.textContent = label;
        tip.hidden = false;
        element.setAttribute(
          "aria-describedby",
          [oldDescription, tip.id].filter(Boolean).join(" "),
        );
        const r = element.getBoundingClientRect();
        const tr = tip.getBoundingClientRect();
        tip.style.left =
          Math.max(
            8,
            Math.min(
              innerWidth - tr.width - 8,
              r.left + r.width / 2 - tr.width / 2,
            ),
          ) + "px";
        tip.style.top =
          (r.top > tr.height + 16 ? r.top - tr.height - 8 : r.bottom + 8) +
          "px";
      }, delay);
    };
    const find = (event: Event) =>
      (event.target as Element).closest<HTMLElement>(
        "[data-tooltip],[data-tip],button[aria-label],a[aria-label]",
      );
    const over = (e: Event) => {
      const el = find(e);
      if (el) show(el);
    };
    const out = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (related && (tip.contains(related) || target?.contains(related)))
        return;
      hideTimer = setTimeout(hide, 120);
    };
    const focus = (e: Event) => {
      const el = find(e);
      if (el) show(el, 0);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const click = (e: Event) => {
      const el = find(e);
      if (
        el &&
        matchMedia("(hover: none)").matches &&
        (el.dataset.tooltip || el.dataset.tip)
      )
        show(el, 0);
      else hide();
    };
    tip.addEventListener("pointerenter", () => clearTimeout(hideTimer));
    tip.addEventListener("pointerleave", hide);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", key);
    document.addEventListener("click", click);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      tip.remove();
      help.remove();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", key);
      document.removeEventListener("click", click);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);
  return null;
}
