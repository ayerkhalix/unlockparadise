import { FeatureLock } from "./feature-lock";
import { OriginalMarkup } from "./original-markup";
import { fragment, localAsset } from "@/lib/content";
import type { Destination, Tier } from "@/lib/destinations";
import { Icon } from "./icon";
import { backendConfigured } from "@/lib/supabase/config";

export function DestinationGate({
  place,
  tier,
}: {
  place: Destination;
  tier: Tier;
}) {
  if (place.requiredTier === "explorer-plus")
    return (
      <main className="upd-main" id="upd-main">
        <div className="upd-container">
          <FeatureLock feature="Explorer+ destination" />
          {tier === "public" && (
            <p className="member-lock__signin">
              Already Explorer+?{" "}
              <a
                href={`/login/?redirect_to=/place/${place.uuid || place.slug}/`}
              >
                Sign in
              </a>
            </p>
          )}
        </div>
      </main>
    );
  const captured = fragment(`place/${place.slug}`);
  if (captured && !backendConfigured())
    return <OriginalMarkup html={captured} />;
  const template = fragment("place/100-cafe-moto")!;
  const start = template.indexOf('<div class="upd-plans">');
  const end = template.indexOf('<p class="upd-gate__signin">');
  const plans = template
    .slice(start, end)
    .replaceAll("/place/100-cafe-moto/", `/place/${place.slug}/`);
  const premium = false;
  return (
    <main className="upd-main" id="upd-main">
      <div className="upd-container">
        <section className="upd-place upd-place--gated upd-gate">
          {premium ? (
            <div className="upd-gate__title">
              <span className="upd-vip-banner upd-vip-banner--lg">
                <Icon name="Lock" size={20} />
                Explorer+
              </span>
            </div>
          ) : (
            <h1 className="upd-gate__title">{place.title}</h1>
          )}
          {place.gallery.length > 0 && (
            <div className="upd-gate__teaser" aria-hidden="true">
              {place.gallery.slice(0, 2).map((url, i) => (
                <div
                  key={url}
                  className={`upd-gate__photo${i === 0 ? " upd-gate__photo--hero" : ""}`}
                  style={{ backgroundImage: `url('${localAsset(url)}')` }}
                />
              ))}
            </div>
          )}
          <div className="upd-gate__intro">
            <h2 className="upd-gate__heading">
              {premium ? (
                <>
                  You need an <span className="upd-gate__tier">Explorer+</span>{" "}
                  account to view this place
                </>
              ) : (
                "You need a free Explorer account to view this place"
              )}
            </h2>
            <p className="upd-gate__sub">
              {premium
                ? "Browsing is open to everyone — this hidden gem is for Explorer+ members. Go Explorer+ below to unlock it."
                : "Browsing is open to everyone — full place pages are for members. Create a free account below, or go Explorer+ for every hidden gem."}
            </p>
          </div>
          <OriginalMarkup html={plans} />
          <p className="upd-gate__signin">
            Already a member?{" "}
            <a href={`/login/?redirect_to=/place/${place.slug}/`}>Sign in</a>
          </p>
        </section>
      </div>
    </main>
  );
}
