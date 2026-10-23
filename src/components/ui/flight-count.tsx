"use client";
import { useEffect, useRef } from "react";
export function FlightCount({ value }: { value: number | string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = ref.current?.animate(
      [
        { opacity: 0.5, transform: "translateY(3px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 200, easing: "cubic-bezier(.16,1,.3,1)" },
    );
    return () => animation?.cancel();
  }, [value]);
  return (
    <b ref={ref} aria-hidden="true">
      {value}
    </b>
  );
}
