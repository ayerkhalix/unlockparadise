"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Keep viewport controls outside page transforms and clipping containers.
export function FloatingDock({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  return mounted ? createPortal(children, document.body) : null;
}
