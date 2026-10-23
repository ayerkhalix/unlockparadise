"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cancelFlights } from "@/lib/travel-motion";
export function FlightLifecycle() {
  const pathname = usePathname();
  useEffect(() => {
    const cancel = () => cancelFlights();
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("resize", cancel);
    window.addEventListener("pagehide", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancel();
      window.removeEventListener("resize", cancel);
      window.removeEventListener("pagehide", cancel);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [pathname]);
  return null;
}
