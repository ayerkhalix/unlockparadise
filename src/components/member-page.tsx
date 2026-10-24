import { mediaAvailable } from "@/lib/media-availability";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { databaseError } from "@/lib/http";
import { card } from "@/lib/repositories/render";
import type { PlaceSummary } from "@/lib/repositories/places";
import { OriginalMarkup } from "./original-markup";
import { ProfileEditor } from "./profile-editor";
import { Icon } from "./icon";
import { ValidatedForm } from "./ui/validated-form";
import { travelPreferences } from "@/lib/repositories/traveler";
import { FeatureLock } from "./feature-lock";
import { TravelerBadgePrivacy } from "./traveler-badge-privacy";
import { TravelerIdentity } from "./traveler-identity";
import { SavedPlacesPage } from "./bucketlist";

export async function MemberPage({ kind }: { kind: string }) {
  const current = await currentSession();
  if (!current) {
    if (kind === "account") redirect("/login/");
    return (
      <main id="upd-main" className="upd-main">
        <div className="p2-shell">
          <FeatureLock
            feature={kind === "portfolio" ? "Portfolio" : "Bucketlist"}
          />
        </div>
      </main>
    );
  }
  if (kind !== "account")
    return (
      <main id="upd-main" className="upd-main">
        <div className="p2-shell">
          {current.premium ? (
            <SavedPlacesPage
              key={kind}
              kind={kind === "portfolio" ? "portfolio" : "bucketlist"}
            />
          ) : (
            <FeatureLock
              feature={kind === "portfolio" ? "Portfolio" : "Bucketlist"}
            />
          )}
        </div>
      </main>
    );
  const profile = await current.db
    .from("profiles")
    .select("*,profile_media(media!profile_media_media_id_fkey(id,status))")
    .eq("id", current.user.id)
    .single();
  databaseError(profile.error);
  const records = await current.db
    .from("member_places")
    .select(
      "saved_at,visited_at,places(id,legacy_id,slug,title,vip_content,travel_minutes,accessibility,assets,published_at,featured,feature_order,place_details(hike_minutes,transport_minutes),place_areas(areas(id,slug,name)),place_categories(categories(id,slug,name)),place_media(kind,position,media(id,status,alt)))",
    )
    .eq("user_id", current.user.id)
    .order("visited_at", { ascending: false, nullsFirst: false })
    .limit(500);
  databaseError(records.error);
  const entries = current.premium
    ? (records.data || []).filter((e) => e.places)
    : [];
  const saved = entries
    .filter((e) => e.saved_at)
    .sort((a, b) => Date.parse(b.saved_at) - Date.parse(a.saved_at));
  const visited = entries
    .filter((e) => e.visited_at)
    .sort((a, b) => Date.parse(b.visited_at) - Date.parse(a.visited_at));
  const subscriptions = await current.db
    .from("subscriptions")
    .select("status,kind,paid_through")
    .eq("user_id", current.user.id)
    .order("created_at", { ascending: false });
  databaseError(subscriptions.error);
  const render = (rows: typeof entries) =>
    rows
      .map((row) => {
        const p = row.places as unknown as PlaceSummary;
        return card(
          {
            ...p,
            saved: Boolean(row.saved_at),
            visited: Boolean(row.visited_at),
          },
          "explorer-plus",
          kind === "account" ? "account-preview" : "default",
        ).replace(
          "</a>",
          `</a><div class="upd-card__featurewrap"><button type="button" class="upd-action upd-action--icon upd-card__feature" data-profile-feature="${p.id}" aria-label="Set as account featured place" data-tooltip="Set as account featured place">☆</button></div>`,
        );
      })
      .join("");
  const upsell = (
    <div className="upd-upgrade">
      <h2>Explore with Explorer+</h2>
      <p>Save and track destinations across Palawan with Explorer+.</p>
      <a className="upd-btn upd-btn--vip" href="/membership/">
        Get Explorer+
      </a>
    </div>
  );
  const data = profile.data;
  const preferences = await travelPreferences(current.db, current.user.id);
  const areas = new Set(
    visited.flatMap((e) =>
      (e.places as unknown as PlaceSummary).place_areas.map((a) => a.areas.id),
    ),
  );
  const photo = data.profile_media?.media;
  const active = subscriptions.data?.find(
    (s) => s.status === "active" || s.status === "cancelled",
  );
  const featured = (
    entries.find(
      (e) =>
        (e.places as unknown as PlaceSummary).id === data.featured_place_id,
    ) ||
    visited[0] ||
    saved[0]
  )?.places as unknown as PlaceSummary | undefined;
  const hero = featured?.place_media.find(
    (m) => m.kind === "cover" && mediaAvailable(m.media),
  )?.media;
  return (
    <main className="upd-main p2-account-page" id="upd-main">
      <div className="upd-container">
        <div className="upd-member-page">
          <div
            className={`upd-profile${hero ? "" : " upd-profile--plain"}`}
            style={
              hero
                ? ({
                    "--upd-profile-hero": `url('/api/media/${hero.id}/')`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            {hero && featured ? (
              <a
                className="upd-profile__band"
                href={`/place/${featured.slug}/`}
                aria-label={`Featured place: ${featured.title}`}
              />
            ) : (
              <div className="upd-profile__band" aria-hidden="true" />
            )}
            <header className="upd-profile__id">
              <div className="profile-avatar-stack">
                <div className="profile-avatar-static">
                  {photo?.status === "ready" ? (
                    <img
                      src={`/api/media/${photo.id}/`}
                      alt="Your profile"
                      width={96}
                      height={96}
                    />
                  ) : (
                    <Icon name="Person" size={48} />
                  )}
                </div>
                <span
                  className={`membership-label membership-label--${current.premium ? "plus" : "explorer"}`}
                >
                  {current.premium ? "Explorer+" : "Explorer"}
                </span>
              </div>
              <div className="profile-identity-block">
                <h1 className="upd-profile__name">{data.display_name}</h1>
                <TravelerIdentity preferences={preferences} />
              </div>
              <p className="upd-profile__meta">
                <span>
                  Member since{" "}
                  {new Date(data.created_at).toLocaleDateString("en-PH", {
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Manila",
                  })}
                </span>
              </p>
              <div className="profile-header-actions">
                <ProfileEditor
                  name={data.display_name}
                  photoId={photo?.status === "ready" ? photo.id : undefined}
                  preferences={preferences}
                />
                <a className="p2-button p3-profile-plan" href="/#palawan-map">
                  View map
                </a>
              </div>
            </header>
            <div className="p3-profile-workspace">
              <aside
                className="p3-profile-sidebar"
                aria-label="Your explorer profile"
              >
                <section className="p3-profile-membership">
                  <h2>Your membership</h2>
                  <strong
                    className={`membership-text membership-text--${current.premium ? "plus" : "explorer"}`}
                  >
                    {current.premium ? "Explorer+" : "Explorer"}
                  </strong>
                  <p>
                    {current.premium
                      ? active?.paid_through
                        ? `Active until ${new Date(active.paid_through).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}`
                        : "Your destinations are unlocked."
                      : "Your free Palawan explorer account."}
                  </p>
                  <a href="/membership/">
                    {current.premium
                      ? "Membership details"
                      : "Explore Explorer+"}
                  </a>
                </section>

                <nav
                  className="p3-profile-links"
                  aria-label="Profile shortcuts"
                >
                  <a href="/bucketlist/">My Bucketlist</a>
                  <a href="/portfolio/">My Portfolio</a>
                  <a href="#account-settings">Account settings</a>
                </nav>
              </aside>
              <div className="p3-profile-content">
                <ul className="upd-stats">
                  <li>
                    <strong>{saved.length}</strong> Bucketlisted
                  </li>
                  <li>
                    <strong>{visited.length}</strong> In Portfolio
                  </li>
                  <li>
                    <strong>{areas.size}</strong> Areas explored
                  </li>
                </ul>
                {current.premium ? (
                  <>
                    {[
                      {
                        title: "My Bucketlist",
                        href: "/bucketlist/",
                        rows: saved,
                      },
                      {
                        title: "My Portfolio",
                        href: "/portfolio/",
                        rows: visited,
                      },
                    ].map((section) => (
                      <section
                        className="upd-profile__section"
                        key={section.href}
                      >
                        <div className="upd-profile__sectionhead">
                          <h2>{section.title}</h2>
                          <a href={section.href}>
                            View all ({section.rows.length}) ›
                          </a>
                        </div>
                        {section.rows.length ? (
                          <OriginalMarkup
                            html={`<div class="upd-rail">${render(section.rows.slice(0, 6))}</div>`}
                          />
                        ) : (
                          <div className="upd-bucketlist-empty">
                            <p>
                              {section.title === "My Portfolio"
                                ? "Your portfolio is empty. Your visited destinations will appear here."
                                : "Your bucketlist is empty — start exploring Palawan."}
                            </p>
                            <a className="upd-btn upd-btn--primary" href="/">
                              Explore places
                            </a>
                          </div>
                        )}
                      </section>
                    ))}
                  </>
                ) : (
                  upsell
                )}
                <section
                  className="upd-profile__section upd-profile__section--settings"
                  id="account-settings"
                >
                  <div className="upd-profile__sectionhead">
                    <h2>Settings</h2>
                    <a href="/itineraries/">Itinerary Planner →</a>
                  </div>
                  <div className="upd-profile__settings">
                    {data.featured_place_id && (
                      <p>
                        <button
                          type="button"
                          className="upd-btn upd-btn--ghost"
                          data-profile-feature=""
                        >
                          Return featured place to automatic
                        </button>
                      </p>
                    )}
                    {preferences?.status === "completed" && (
                      <details className="upd-profile__row">
                        <summary>
                          <span className="upd-profile__rowlabel">Privacy</span>
                          <span className="upd-profile__rowval">
                            Traveler identity visibility
                          </span>
                        </summary>
                        <div className="upd-profile__rowbody">
                          <TravelerBadgePrivacy
                            key={preferences.version}
                            initial={preferences}
                          />
                        </div>
                      </details>
                    )}
                    <details className="upd-profile__row">
                      <summary>
                        <span className="upd-profile__rowlabel">Password</span>
                        <span className="upd-profile__rowval">
                          Change password
                        </span>
                      </summary>
                      <div className="upd-profile__rowbody">
                        <ValidatedForm
                          className="upd-auth-form"
                          data-endpoint="/api/auth/password/"
                          method="post"
                          action="/api/auth/password/"
                        >
                          <label className="upd-auth-field">
                            Current password
                            <input
                              name="current_password"
                              type="password"
                              autoComplete="current-password"
                              required
                            />
                          </label>
                          <label className="upd-auth-field">
                            New password
                            <input
                              name="password"
                              type="password"
                              minLength={8}
                              maxLength={200}
                              autoComplete="new-password"
                              required
                            />
                          </label>
                          <button
                            className="upd-btn upd-btn--primary"
                            type="submit"
                          >
                            Change password
                          </button>
                          <span role="status" />
                        </ValidatedForm>
                      </div>
                    </details>
                    <details className="upd-profile__row">
                      <summary>
                        <span className="upd-profile__rowlabel">
                          Membership
                        </span>
                        <span
                          className={`upd-profile__rowval membership-text membership-text--${current.premium ? "plus" : "explorer"}`}
                        >
                          {current.premium ? "Explorer+" : "Explorer"}
                        </span>
                      </summary>
                      <div className="upd-profile__rowbody">
                        {active?.paid_through ? (
                          <p>
                            Until{" "}
                            {new Date(active.paid_through).toLocaleDateString(
                              "en-PH",
                              { timeZone: "Asia/Manila" },
                            )}
                            . Paid once, no automatic charges.
                          </p>
                        ) : (
                          <p>
                            {current.premium
                              ? "Your Explorer+ membership has no billing attached."
                              : "Your Explorer account is free."}
                          </p>
                        )}
                        <a className="upd-btn upd-btn--vip" href="/checkout/">
                          {current.premium ? "Renew" : "Get Explorer+"}
                        </a>
                      </div>
                    </details>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
