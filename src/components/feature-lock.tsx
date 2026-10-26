import { Icon } from "./icon";
import { GateBack, GateUpgrade } from "./gate-navigation";
import { currentSession } from "@/lib/auth/session";

export async function FeatureLock({
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
  const current = await currentSession();
  return (
    <section className="feature-hook" aria-label={`${feature} access`}>
      <div
        className="member-lock member-lock--feature"
        aria-labelledby="member-lock-title"
      >
        <div className="member-lock__symbol" aria-hidden="true">
          <Icon name="Lock" size={58} />
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
          <GateUpgrade
            tier={
              current
                ? current.premium
                  ? "explorer-plus"
                  : "explorer"
                : "public"
            }
          />
        )}
      </div>
      <GateBack />
    </section>
  );
}
