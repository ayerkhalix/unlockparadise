import { FeatureLock } from "./feature-lock";
import type { Destination, Tier } from "@/lib/destinations";
export function DestinationGate({ place }: { place: Destination; tier: Tier }) {
  const premium = place.requiredTier === "explorer-plus";
  return (
    <main className="upd-main" id="upd-main">
      <div className="upd-container">
        <FeatureLock
          kind="destination"
          feature={premium ? "Explorer+ destination" : place.title}
          required={premium ? "explorer-plus" : "explorer"}
          returnTo={`/place/${place.uuid || place.slug}/`}
        />
      </div>
    </main>
  );
}
