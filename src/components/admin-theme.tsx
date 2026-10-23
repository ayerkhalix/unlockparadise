"use client";
import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(
  null,
);
export function AdminThemeScope({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [theme, setTheme] = useState(initial);
  const admin = path.startsWith("/admin") && !path.startsWith("/admin/preview");
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.cookie = `upd-admin-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setTheme(next);
  }
  return (
    <ThemeContext.Provider value={admin ? { theme, toggle } : null}>
      <div className="app-theme" data-admin-theme={admin ? theme : undefined}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
export function useAdminTheme() {
  return useContext(ThemeContext);
}
export function AdminThemeToggle() {
  const context = useAdminTheme();
  if (!context) return null;
  return (
    <button
      type="button"
      className="studio-theme-toggle"
      onClick={context.toggle}
      aria-label={`Switch to ${context.theme === "dark" ? "light" : "dark"} theme`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        {context.theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.7 13.6A9 9 0 0 1 10.4 3.3a9 9 0 1 0 10.3 10.3Z" />
        )}
      </svg>
      <span>{context.theme === "dark" ? "Light" : "Dark"} theme</span>
    </button>
  );
}
export function AdminBrand() {
  return (
    <span className="studio-brand-content">
      <img
        src="/original/wp-content/uploads/2026/07/upd-mark-white-header-300x300.png"
        width="42"
        height="42"
        alt=""
      />
      <span>
        Unlock Paradise<small>Admin Studio</small>
      </span>
    </span>
  );
}
