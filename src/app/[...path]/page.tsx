import { mediaAvailable } from "@/lib/media-availability";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { fragment } from "@/lib/content";
import { OriginalMarkup } from "@/components/original-markup";
import { ArchiveBehavior } from "@/components/archive-behavior";
import { contactMarkup, membershipMarkup } from "@/lib/auth/markup";
import { currentSession } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/http";
import { AuthForm } from "@/components/auth-form";
import { backendConfigured } from "@/lib/supabase/config";
import { findPlaces, taxonomy } from "@/lib/repositories/places";
import { archiveMarkup, escape } from "@/lib/repositories/render";
import { viewerTier } from "@/lib/destinations";
import { MemberPage } from "@/components/member-page";
import { ResetPassword } from "@/components/reset-password";
import { Checkout } from "@/components/checkout";
import { AreaNavigation } from "@/components/area-navigation";
import { FeatureLock } from "@/components/feature-lock";
import { googleReturnPath } from "@/lib/auth/google";
import { MembershipStatus } from "@/components/membership-status";

const titles: Record<string, string> = {
  about: "About",
  membership: "Membership",
  contact: "Contact Us",
  login: "Sign in",
  join: "Join free",
  "forgot-password": "Forgot password",
  "privacy-policy": "Privacy Policy",
  terms: "Terms of Service",
  refunds: "Refunds",
  checkout: "Explorer+",
};
type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  return {
    title:
      titles[path.join("/")] ||
      path.at(-1)?.replaceAll("-", " ") ||
      "Unlock Paradise",
  };
}
export default async function PublicPage({ params, searchParams }: Props) {
  const { path } = await params;
  const key = path.join("/");
  if (key === "login" || key === "join") {
    const query = await searchParams;
    if (await currentSession()) {
      const destination = safeRedirect((await searchParams).redirect_to);
      redirect(
        /^\/(?:login|join)(?:\/|\?|$)/.test(destination)
          ? "/account/"
          : destination,
      );
    }
    return (
      <AuthForm
        route={key}
        next={googleReturnPath(query.redirect_to)}
        error={typeof query.error === "string" ? query.error : undefined}
      />
    );
  }
  if (key === "explorer-plus") {
    const query = await searchParams;
    const features: Record<string, string> = {
      bucketlist: "Bucketlist",
      portfolio: "Portfolio",
      itinerary: "Itinerary Planner",
    };
    return (
      <main id="upd-main" className="upd-main">
        <div className="p2-shell">
          <FeatureLock
            feature={
              features[String(query.feature)] || "Explorer+ destinations"
            }
          />
        </div>
      </main>
    );
  }
  if (key === "forgot-password") return <AuthForm route={key} />;
  if (["account", "bucketlist", "portfolio"].includes(key))
    return <MemberPage kind={key} />;
  if (key === "reset-password") return <ResetPassword />;
  if (key === "checkout" && backendConfigured()) {
    const query = await searchParams;
    return (
      <Checkout
        returnTo={
          typeof query.return_to === "string" ? query.return_to : undefined
        }
        paymentReturn={query.payment === "return"}
        transactionId={
          typeof query.transaction_id === "string"
            ? query.transaction_id
            : undefined
        }
      />
    );
  }
  if (key === "membership" && (await currentSession())?.premium)
    return <MembershipStatus />;
  let html = fragment(key);
  const isArchive = ["area", "place_category"].includes(path[0]);
  let areaNavigation: React.ReactNode = null;
  if (backendConfigured() && isArchive) {
    if (path.length < 2 || path.length > (path[0] === "area" ? 3 : 2))
      notFound();
    const terms = await taxonomy();
    const area =
      path[0] === "area"
        ? terms.areas.find((a) => a.slug === path[1])
        : undefined;
    const categorySlug = path[0] === "area" ? path[2] : path[1];
    const category = categorySlug
      ? terms.categories.find((c) => c.slug === categorySlug)
      : undefined;
    if ((path[0] === "area" && !area) || (categorySlug && !category))
      notFound();
    if (area)
      areaNavigation = (
        <AreaNavigation
          area={area}
          categories={terms.categories}
          selected={categorySlug}
        />
      );
    html = html || fragment("area/ppc-north/beaches")!;
    html = html
      .replace(
        /<h1 class="upd-feed__title">[\s\S]*?<\/h1>/,
        `<h1 class="upd-feed__title">${area && category ? `<span class="upd-feed__title-pre">${escape(area.name)}</span>` : ""}<span class="upd-feed__title-main">${escape(category?.name || area?.name)}</span></h1>`,
      )
      .replace(
        /<p class="upd-feed__desc">[\s\S]*?<\/p>/,
        `<p class="upd-feed__desc">${escape(area?.description || category?.description || "")}</p>`,
      );
    const thumb = category?.taxonomy_media?.[0]?.media;
    if (mediaAvailable(thumb))
      html = html.replace(
        /--upd-feed-hero:url\('[^']*'\)/,
        `--upd-feed-hero:url('/api/media/${thumb.id}/')`,
      );
    else html = html.replace(/ style="--upd-feed-hero:[^"]*"/, "");
  }
  if (!html) notFound();
  if (key === "membership")
    html = membershipMarkup(
      html,
      (await currentSession()) ? "explorer" : "public",
      typeof (await searchParams).return_to === "string"
        ? ((await searchParams).return_to as string)
        : undefined,
    );
  if (key === "contact") html = contactMarkup(html);
  if (backendConfigured() && ["area", "place_category"].includes(path[0])) {
    const places = await findPlaces({
      area: path[0] === "area" ? path[1] : undefined,
      category: path[0] === "area" ? path[2] : path[1],
      limit: 500,
      memberState: true,
    });
    html = archiveMarkup(html, places, await viewerTier());
  }
  return (
    <>
      {areaNavigation}
      <OriginalMarkup html={html} />
      {["area", "place_category"].includes(path[0]) && <ArchiveBehavior />}
    </>
  );
}
