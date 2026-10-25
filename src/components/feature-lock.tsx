import { Icon } from "./icon";
import { GateBack, GateUpgrade } from "./gate-navigation";

export function FeatureLock({
  feature,
  kind = "feature",
  required = "explorer-plus",
  returnTo = "/account/",
}: {
  feature: string;
  kind?: "feature" | "destination";
  required?: "explorer" | "explorer-plus";
  returnTo?: string;
}) {
  return (
    <section className="member-lock" aria-labelledby="member-lock-title">
      <div className="member-lock__symbol" aria-hidden="true">
        <Icon name="Lock" size={92} />
      </div>
      <h1 id="member-lock-title">{feature}</h1>
      <p>
        {required === "explorer" ? (
          <>
            Create a free <strong>Explorer</strong> account to explore this
            destination.
          </>
        ) : (
          <>
            Upgrade to <strong>Explorer+</strong> to{" "}
            {kind === "destination"
              ? "explore this destination"
              : "access this feature"}
            .
          </>
        )}
      </p>
      {required === "explorer" ? (
        <a
          className="upd-btn upd-btn--primary"
          href={`/join/?redirect_to=${encodeURIComponent(returnTo)}`}
        >
          Join free
        </a>
      ) : (
        <GateUpgrade />
      )}
      <GateBack />
    </section>
  );
}
