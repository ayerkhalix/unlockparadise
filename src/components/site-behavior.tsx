"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function SiteBehavior() {
  const pathname = usePathname();
  useEffect(() => {
    const scroll = () =>
      document.body.classList.toggle("upd-scrolled", window.scrollY > 80);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    const galleryKey = (event: KeyboardEvent) => {
      const track = (event.target as Element).closest<HTMLElement>(
        "[data-upd-strip]",
      );
      if (
        !track ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      event.preventDefault();
      const left =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? track.scrollWidth
            : track.scrollLeft +
              (event.key === "ArrowLeft" ? -1 : 1) * track.clientWidth;
      track.scrollTo({
        left,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    };
    document.addEventListener("keydown", galleryKey);
    let stripStart: { track: HTMLElement; left: number } | null = null;
    const stripDown = (event: PointerEvent) => {
      const track = (event.target as Element).closest<HTMLElement>(
        "[data-upd-strip]",
      );
      stripStart = track ? { track, left: track.scrollLeft } : null;
    };
    const stripClick = (event: MouseEvent) => {
      if (
        event.detail &&
        stripStart &&
        stripStart.track.contains(event.target as Node) &&
        Math.abs(stripStart.track.scrollLeft - stripStart.left) > 8
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", stripDown);
    document.addEventListener("click", stripClick, true);
    const buttons: {
      button: HTMLButtonElement;
      input: HTMLInputElement;
      wrapper?: HTMLSpanElement;
    }[] = [];
    document
      .querySelectorAll<HTMLInputElement>('input[type="password"]')
      .forEach((input) => {
        const ownedWrapper =
          input.parentElement?.classList.contains("p2-password-field");
        const wrapper = ownedWrapper
          ? undefined
          : document.createElement("span");
        if (wrapper) {
          wrapper.className = "p2-password-field";
          input.before(wrapper);
          wrapper.append(input);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "p2-password-toggle";
        const label =
          input.name === "current_password"
            ? "current password"
            : input.name === "confirm_password"
              ? "confirmed password"
              : "password";
        const paint = () => {
          const shown = input.type === "text";
          const name = `${shown ? "Hide" : "Show"} ${label}`;
          button.setAttribute("aria-label", name);
          button.setAttribute("data-tooltip", name);
          button.setAttribute("aria-pressed", String(shown));
          button.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${shown ? '<path d="m3 3 18 18"/>' : ""}</svg>`;
        };
        paint();
        button.addEventListener("click", () => {
          input.type = input.type === "password" ? "text" : "password";
          paint();
        });
        input.insertAdjacentElement("afterend", button);
        buttons.push({ button, input, wrapper });
      });
    return () => {
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("keydown", galleryKey);
      document.removeEventListener("pointerdown", stripDown);
      document.removeEventListener("click", stripClick, true);
      buttons.forEach(({ button, input, wrapper }) => {
        button.remove();
        input.type = "password";
        if (wrapper?.isConnected) {
          wrapper.before(input);
          wrapper.remove();
        }
      });
    };
  }, [pathname]);
  return null;
}
