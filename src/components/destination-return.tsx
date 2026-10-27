"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { safeBrowseReturn } from "@/lib/browsing-return";

export function DestinationReturn({ fallback }: { fallback: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const target = safeBrowseReturn(params.get("return_to")) || fallback;
  return (
    <a
      className="upd-place-return upd-place-return--plain"
      href={target}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        try {
          sessionStorage.setItem("upd:restore-browse", target);
        } catch {
          /* Native back still works. */
        }
        if (history.state?.updBrowseOrigin === target && history.length > 1)
          router.back();
        else router.push(target, { scroll: false });
      }}
    >
      ‹ Return
    </a>
  );
}
