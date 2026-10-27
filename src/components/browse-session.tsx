"use client";
import { createContext, useContext, useMemo } from "react";

type BrowseSession = {
  scope: string;
  read: <T>(key: string) => T | undefined;
  write: <T>(key: string, value: T) => void;
  remove: (key: string) => void;
};
const Context = createContext<BrowseSession | null>(null);

/** Private, bounded, in-memory list snapshots; never shared across accounts or persisted. */
export function BrowseSessionProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const session = useMemo<BrowseSession>(() => {
    const entries = new Map<string, { value: unknown; expires: number }>();
    return {
      scope,
      read: <T,>(key: string) => {
        const entry = entries.get(key);
        return entry && entry.expires > Date.now()
          ? (entry.value as T)
          : undefined;
      },
      write: (key, value) => {
        entries.delete(key);
        entries.set(key, { value, expires: Date.now() + 5 * 60_000 });
        if (entries.size > 16) entries.delete(entries.keys().next().value!);
      },
      remove: (key) => {
        entries.delete(key);
      },
    };
  }, [scope]);
  return (
    <Context.Provider key={scope} value={session}>
      {children}
    </Context.Provider>
  );
}
export function useBrowseSession() {
  return useContext(Context);
}
