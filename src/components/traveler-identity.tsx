import {
  archetypes,
  interests,
  type TravelPreferences,
  type PublicTravelerBadge,
} from "@/lib/traveler";
import { Icon } from "./icon";
import { TravelerTitle } from "./traveler-title";
export function TravelerBadges({
  identity,
}: {
  identity: Pick<PublicTravelerBadge, "archetype" | "interests">;
}) {
  const archetype = archetypes[identity.archetype];
  if (!archetype) return null;
  return (
    <div className="td-badges" aria-label="Traveler identity badges">
      <span className="td-badge td-badge--primary">
        <Icon name={archetype.icon} size={14} />
        {archetype.label}
      </span>
      {identity.interests.slice(0, 2).map((key) => {
        const interest = interests.find((i) => i.key === key);
        return interest ? (
          <span key={key} className="td-badge">
            {interest.label}
          </span>
        ) : null;
      })}
    </div>
  );
}
export function TravelerIdentity({
  preferences,
}: {
  preferences: TravelPreferences | null;
}) {
  if (preferences?.status !== "completed") return null;
  const identity =
    archetypes[preferences.archetype] || archetypes["curious-explorer"];
  return (
    <section className="td-identity" aria-labelledby="traveler-identity-title">
      <div className="td-identity__heading">
        <div>
          <h2 id="traveler-identity-title">
            <TravelerTitle selected={preferences.interests}>
              {identity.label}
            </TravelerTitle>
          </h2>
          <p className="traveler-likes">
            <strong>Likes:</strong>{" "}
            {preferences.interests.length
              ? preferences.interests
                  .map((key) => interests.find((i) => i.key === key)!.label)
                  .join(", ")
              : "Still exploring"}
          </p>
        </div>
      </div>
      <a
        className="p2-button p2-button--quiet"
        href="/traveler-discovery/?next=%2Faccount%2F"
      >
        Edit Travel Preferences
      </a>
    </section>
  );
}
