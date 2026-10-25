import { Icon } from "./icon";
import { GateBack } from "./gate-navigation";
import { ContentImage } from "./ui/content-image";
import { MembershipComparison } from "./membership-comparison";
import type { Destination, Tier } from "@/lib/destinations";
export function DestinationGate({
  place,
  tier,
}: {
  place: Destination;
  tier: Tier;
}) {
  const premium = place.requiredTier === "explorer-plus";
  const returnTo = `/place/${place.uuid || place.slug}/`;
  const photo =
    premium && place.uuid ? `/api/previews/${place.uuid}/` : place.cover;
  return (
    <main className="upd-main" id="upd-main">
      <div className="upd-container">
        <section
          className="member-lock destination-gate"
          aria-labelledby="destination-gate-title"
        >
          <div
            className={`destination-gate__tier${premium ? " destination-gate__tier--plus" : ""}`}
          >
            <Icon name="Lock" size={16} /> {premium ? "Explorer+" : "Explorer"}
          </div>
          {photo && (
            <div className="destination-gate__photo">
              <ContentImage
                src={photo}
                alt={
                  premium
                    ? "A preview of this Explorer+ destination"
                    : place.title
                }
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 800px) 100vw, 1100px"
              />
            </div>
          )}
          <div className="destination-gate__intro">
            <h1 id="destination-gate-title">
              You need an <strong>{premium ? "Explorer+" : "Explorer"}</strong>{" "}
              account to view this place
            </h1>
            <p>
              {premium
                ? "A glimpse of what’s waiting. Unlock the full destination guide with Explorer+."
                : "Create your free Explorer account for destination photos, details and directions."}
            </p>
          </div>
          <MembershipComparison tier={tier} returnTo={returnTo} />
          <GateBack />
        </section>
      </div>
    </main>
  );
}
