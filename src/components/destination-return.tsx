"use client";
import { useSearchParams } from "next/navigation";
import { safeBrowseReturn } from "@/lib/browsing-return";

export function DestinationReturn({ fallback }: { fallback: string }) {
  const params = useSearchParams();
  const target = safeBrowseReturn(params.get("return_to")) || fallback;
  return (
    <a
      className="upd-place-return upd-place-return--plain"
      href={target}
      onClick={() => {
        try {
          sessionStorage.setItem("upd:restore-browse", target);
        } catch {
          /* Native back still works. */
        }
      }}
    >
      ‹ Return
    </a>
  );
}
