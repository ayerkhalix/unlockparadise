"use client";
import { useEffect, useState } from "react";
export function Feedback() {
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      clearTimeout(timer);
      setNotice((event as CustomEvent).detail);
      if (!(event as CustomEvent).detail.error)
        timer = setTimeout(() => setNotice(null), 7000);
    };
    window.addEventListener("upd:notice", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("upd:notice", show);
    };
  }, []);
  return (
    <div className="p2-notices" aria-live="polite" aria-atomic="true">
      {notice && (
        <div className={`p2-notice${notice.error ? " p2-notice--error" : ""}`}>
          <span>{notice.message}</span>
          <button
            type="button"
            className="p2-icon"
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
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
    let target: HTMLElement | null = null,
      oldDescription: string | null = null,
      timer: ReturnType<typeof setTimeout>,
      hideTimer: ReturnType<typeof setTimeout>;
    const hide = () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
      tip.hidden = true;
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
        const host = element.closest("dialog[open]") || document.body;
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
