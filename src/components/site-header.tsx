"use client";
import { ContentImage } from "@/components/ui/content-image";

/* eslint-disable @next/next/no-location-assign-relative-destination -- Sign-out must discard all member client state and reload the anonymous server layout. */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "./ui/modal";
import { notify, requestJSON } from "@/lib/client-api";
function ProfileIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </svg>
  );
}
type Props = { tier: string; name?: string; photo?: string };
const primaryLinks = [
  ["About", "/about/"],
  ["Membership", "/membership/"],
  ["Merch", "/merch/"],
  ["Contact Us", "/contact/"],
  ["Itinerary Planner", "/itineraries/"],
];
function currentPage(pathname: string, href: string) {
  return pathname === href.slice(0, -1) || pathname.startsWith(href);
}
const accountLinks = [
  ["My Account", "/account/"],
  ["My Bucketlist", "/bucketlist/"],
  ["Itinerary Planner", "/itineraries/"],
  ["My Portfolio", "/portfolio/"],
  ["Membership", "/membership/"],
];
function ProfileDisclosure({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node))
        ref.current?.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details
      ref={ref}
      className="p2-account"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          ref.current?.removeAttribute("open");
          ref.current?.querySelector("summary")?.focus();
        }
      }}
    >
      {children}
    </details>
  );
}
function AccountMenu({ tier, name, photo }: Props) {
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  return (
    <ProfileDisclosure>
      <summary aria-label="Profile" data-tooltip="Your account">
        <span className="p2-avatar" aria-hidden="true">
          {photo ? (
            <ContentImage sizes="96px" src={photo} alt="" />
          ) : (
            <ProfileIcon />
          )}
        </span>
      </summary>
      <nav className="p2-account__menu" aria-label="Account">
        <strong>{name || "Explorer"}</strong>
        <span
          className={`membership-text membership-text--${tier === "explorer-plus" ? "plus" : "explorer"}`}
        >
          {tier === "explorer-plus" ? "Explorer+" : "Explorer"}
        </span>
        {accountLinks.map(([label, href]) => (
          <a
            key={href}
            href={href}
            aria-current={currentPage(pathname, href) ? "page" : undefined}
          >
            {label}
          </a>
        ))}
        <button
          disabled={busy}
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              await requestJSON("/api/auth/logout/", "POST", {});
              location.assign("/");
            } catch (e) {
              notify((e as Error).message, true);
              setBusy(false);
            }
          }}
        >
          {busy ? "Signing out…" : "Log Out"}
        </button>
      </nav>
    </ProfileDisclosure>
  );
}
function GuestProfile() {
  return (
    <ProfileDisclosure>
      <summary aria-label="Profile" data-tooltip="Sign in or register">
        <span className="p2-avatar" aria-hidden="true">
          <ProfileIcon />
        </span>
      </summary>
      <nav className="p2-account__menu" aria-label="Profile">
        <a href="/login/">Sign in</a>
        <a href="/join/">Register</a>
      </nav>
    </ProfileDisclosure>
  );
}
export function SiteHeader(props: Props) {
  const pathname = usePathname();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const nav = (
    <>
      {primaryLinks.map(([label, href]) => (
        <a
          key={href}
          href={href}
          aria-current={currentPage(pathname, href) ? "page" : undefined}
        >
          {label}
        </a>
      ))}
    </>
  );
  return (
    <>
      <header
        className="upd-header"
        id="upd-header"
        data-home={pathname === "/" ? "true" : undefined}
      >
        <div className="upd-header__inner">
          <div className="upd-header__row">
            <div className="upd-header__branding">
              <div className="upd-header__logowrap">
                <a
                  className="upd-header__brand"
                  href="/"
                  aria-label="Unlock Paradise home"
                >
                  <ContentImage
                    sizes="96px"
                    width="300"
                    height="300"
                    src="/original/wp-content/uploads/2026/07/upd-mark-white-header-300x300.png"
                    className="upd-header__logo"
                    alt=""
                    fetchPriority="high"
                  />
                </a>
              </div>
              <span className="upd-header__titlewrap">
                <a className="upd-header__title" href="/">
                  Unlock Paradise
                </a>
              </span>
            </div>
            <nav className="upd-header__nav" aria-label="Primary">
              <div className="p2-nav">
                {nav}
                {props.tier === "public" ? (
                  <GuestProfile />
                ) : (
                  <AccountMenu {...props} />
                )}
              </div>
            </nav>
            <button
              ref={menuTrigger}
              className="upd-header__toggle"
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M3 6h18M3 12h18M3 18h18"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>
      {open && (
        <Modal
          title="Menu"
          heading={
            props.tier !== "public" ? (
              <a
                className="mobile-menu-identity"
                href="/account/"
                aria-current={
                  currentPage(pathname, "/account/") ? "page" : undefined
                }
              >
                <span className="p2-avatar">
                  {props.photo ? (
                    <ContentImage src={props.photo} alt="" sizes="64px" />
                  ) : (
                    <ProfileIcon />
                  )}
                </span>
                <span>
                  <strong>{props.name || "Explorer"}</strong>
                  <small
                    className={`membership-text--${props.tier === "explorer-plus" ? "plus" : "explorer"}`}
                  >
                    {props.tier === "explorer-plus" ? "Explorer+" : "Explorer"}
                  </small>
                </span>
              </a>
            ) : (
              "Unlock Paradise"
            )
          }
          onClose={() => setOpen(false)}
          drawer
          side="right"
          returnFocusRef={menuTrigger}
        >
          <nav className="p2-mobile-nav" aria-label="Mobile">
            {nav}
            <div className="mobile-account-links">
              {props.tier === "public" ? (
                <>
                  <a href="/login/">Sign in</a>
                  <a href="/join/">Register free</a>
                </>
              ) : (
                <>
                  <a
                    href="/portfolio/"
                    aria-current={
                      currentPage(pathname, "/portfolio/") ? "page" : undefined
                    }
                  >
                    My Portfolio
                  </a>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={async () => {
                      setSigningOut(true);
                      try {
                        await requestJSON("/api/auth/logout/", "POST", {});
                        location.assign("/");
                      } catch (error) {
                        notify((error as Error).message, true);
                        setSigningOut(false);
                      }
                    }}
                  >
                    {signingOut ? "Signing out…" : "Log out"}
                  </button>
                </>
              )}
            </div>
          </nav>
          <p className="p2-muted">The side of Palawan they don’t tell you.</p>
          <nav className="mobile-menu-legal" aria-label="Menu legal links">
            <a href="/privacy-policy/">Privacy</a>
            <a href="/terms/">Terms</a>
            <a href="/refunds/">Refunds</a>
          </nav>
        </Modal>
      )}
    </>
  );
}
