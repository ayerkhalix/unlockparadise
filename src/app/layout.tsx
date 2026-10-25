/* eslint-disable @next/next/no-css-tags -- Preserve the audited theme's stylesheet cascade without reordering it at build time. */
import type { Metadata } from "next";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { fragment, originalStylesheets } from "@/lib/content";
import { OriginalMarkup } from "@/components/original-markup";
import { SiteBehavior } from "@/components/site-behavior";
import { viewerTier } from "@/lib/destinations";
import { BackendForms } from "@/components/backend-forms";
import { MemberActions } from "@/components/member-actions";
import { SiteHeader } from "@/components/site-header";
import { Feedback, Tooltips } from "@/components/ui/feedback";
import { TravelCompanion } from "@/components/travel-companion";
import { currentSession } from "@/lib/auth/session";
import "./phase2.css";
import "./traveler.css";
import "./client-todo.css";
import { AnalyticsPreferences } from "@/components/analytics-preferences";
import { cookies } from "next/headers";
import { AdminThemeScope } from "@/components/admin-theme";
import { FlightLifecycle } from "@/components/flight-lifecycle";
import { BrowsingTrail } from "@/components/gate-navigation";
import { StaticImageRecovery } from "@/components/ui/static-image-recovery";

export const metadata: Metadata = {
  title: { default: "Unlock Paradise", template: "%s - Unlock Paradise" },
  description: "Rent a bike, pick a spot, and unlock paradise.",
  robots: { index: false, follow: false },
  icons: { icon: "/original/wp-content/uploads/2026/07/upd-favicon-teal.png" },
};
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tier = await viewerTier();
  const adminTheme =
    (await cookies()).get("upd-admin-theme")?.value === "light"
      ? "light"
      : "dark";
  const current = await currentSession();
  const profile = current
    ? (
        await current.db
          .from("profiles")
          .select(
            "display_name,profile_media(media!profile_media_media_id_fkey(id,status))",
          )
          .eq("id", current.user.id)
          .maybeSingle()
      ).data
    : null;
  const photo = profile?.profile_media as unknown as {
    media: { id: string; status: string };
  } | null;
  return (
    <html lang="en-US">
      <head>
        <link rel="stylesheet" href="/original/vendor/swiper-bundle.min.css" />
        <link rel="stylesheet" href="/original/vendor/glightbox.min.css" />
        {originalStylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <link
          rel="stylesheet"
          href="/original/wp-content/plugins/sureforms/assets/css/minified/blocks/default/frontend.min.css"
        />
        <link
          rel="stylesheet"
          href="/original/wp-content/plugins/sureforms/assets/css/minified/common.min.css"
        />
        <link
          rel="stylesheet"
          href="/original/wp-content/plugins/sureforms/assets/css/minified/frontend/form.min.css"
        />
      </head>
      <body
        className={`upd-surface--navy${tier !== "public" ? " logged-in" : ""}`}
      >
        <AdminThemeScope initial={adminTheme}>
          <a className="upd-skip" href="#upd-main">
            Skip to content
          </a>
          <div className="upd-site">
            <SiteHeader
              tier={tier}
              name={profile?.display_name}
              photo={
                photo?.media?.status === "ready"
                  ? `/api/media/${photo.media.id}/`
                  : undefined
              }
            />
            {children}
            <OriginalMarkup html={fragment("footer")!} />
            <AnalyticsPreferences />
          </div>
          <SiteBehavior />
          <StaticImageRecovery />
          <BrowsingTrail />
          <BackendForms />
          <MemberActions />
          <TravelCompanion tier={tier} />
          <Feedback />
          <Tooltips />
          <FlightLifecycle />
        </AdminThemeScope>
      </body>
    </html>
  );
}
