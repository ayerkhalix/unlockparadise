import type { Metadata } from "next";
import { Suspense } from "react";
import { OriginalMarkup } from "@/components/original-markup";
import { PalawanMap } from "@/components/palawan-map";
import { backendConfigured } from "@/lib/supabase/config";
import { findPlaces } from "@/lib/repositories/places";
import { featuredMarkup, heroMarkup } from "@/lib/repositories/render";
import { mapConfiguration } from "@/lib/repositories/maps";
import { fragment } from "@/lib/content";
import { currentSession } from "@/lib/auth/session";
import { travelPreferences } from "@/lib/repositories/traveler";
import { interests } from "@/lib/traveler";
import { TravelerInvitation } from "@/components/traveler-invitation";
import { HomeMerch } from "@/components/merch/home-merch";
import { catalog } from "@/lib/repositories/commerce";
import { products as originalProducts } from "@/lib/merch-products";
import originalMap from "@/data/map.json";
import { upgradeHref } from "@/lib/membership-navigation";

export const metadata: Metadata = { title: "Home" };
async function HomeFeatured() {
  const current = await currentSession();
  const preferences = current
    ? await travelPreferences(current.db, current.user.id)
    : null;
  const personalized =
    Boolean(current?.premium) &&
    preferences?.status === "completed" &&
    preferences.interests.length > 0;
  const places = backendConfigured()
    ? await findPlaces(
        { featured: !personalized, personalized, limit: 4 },
        current?.db,
      )
    : [];
  const explanations: Record<string, string> = {};
  if (personalized)
    for (const place of places) {
      const matching = place.place_categories.find((c) =>
        interests.some(
          (i) =>
            preferences.interests.includes(i.key) &&
            (i.categories as readonly string[]).includes(c.categories.slug),
        ),
      );
      if (matching)
        explanations[place.id] =
          `Picked for your love of ${matching.categories.name.toLowerCase()}`;
    }
  const featured = backendConfigured()
    ? featuredMarkup(places, explanations)
    : fragment("featured")!;
  return <OriginalMarkup html={featured} />;
}
async function HomeMerchPreview() {
  const merch = backendConfigured() ? await catalog() : originalProducts;
  return <HomeMerch products={merch} />;
}
async function HomeInvitation() {
  const current = await currentSession();
  const preferences = current
    ? await travelPreferences(current.db, current.user.id)
    : null;
  return current && (!preferences || preferences.status === "pending") ? (
    <TravelerInvitation version={preferences?.version} />
  ) : null;
}
async function HomeUpgrade() {
  const current = await currentSession();
  return !current?.premium ? (
    <section className="destination-invitation">
      <div>
        <h2>There’s more to discover.</h2>
        <p>
          Explore the destinations reserved for Explorer+ and find your next
          place in Palawan.
        </p>
      </div>
      <a
        className="upd-btn upd-btn--vip"
        href={upgradeHref(current ? "explorer" : "public", "/#palawan-map")}
      >
        Explore Explorer+
      </a>
    </section>
  ) : null;
}
export default async function HomePage() {
  const map = backendConfigured() ? await mapConfiguration() : undefined;
  return (
    <main className="upd-main" id="upd-main">
      <div className="upd-container">
        <div className="upd-home">
          <OriginalMarkup
            html={heroMarkup(fragment("hero")!, map || originalMap)}
          />
          <PalawanMap data={map} />
          <Suspense
            fallback={
              <div className="home-section-loading" role="status">
                Loading featured destinations…
              </div>
            }
          >
            <HomeFeatured />
          </Suspense>
          <Suspense fallback={null}>
            <HomeUpgrade />
          </Suspense>
          <Suspense
            fallback={
              <div className="home-section-loading" role="status">
                Loading merchandise…
              </div>
            }
          >
            <HomeMerchPreview />
          </Suspense>
          <Suspense fallback={null}>
            <HomeInvitation />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
