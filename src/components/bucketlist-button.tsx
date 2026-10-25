"use client";
import { Icon } from "./icon";

/** Mutations and Undo are owned by the same delegated controller as normal Places. */
export function BucketlistButton({
  placeId,
  saved,
  loading = false,
}: {
  placeId: string;
  saved: boolean;
  loading?: boolean;
}) {
  const label = saved ? "Remove from Bucketlist" : "Add to Bucketlist";
  return (
    <button
      type="button"
      className={`upd-action upd-action--icon planner-save${saved ? " is-saved" : ""}`}
      data-member-op={saved ? "unsave" : "save"}
      data-place-uuid={placeId}
      aria-label={label}
      aria-pressed={saved}
      data-tooltip={label}
      disabled={loading}
    >
      <Icon name="Bucket" size={19} />
    </button>
  );
}
