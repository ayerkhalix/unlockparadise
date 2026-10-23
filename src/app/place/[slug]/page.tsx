import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { backendConfigured } from "@/lib/supabase/config";
import { serverSupabase } from "@/lib/supabase/server";
import { canView, destinationRepository, viewerTier } from "@/lib/destinations";
import { DestinationGate } from "@/components/destination-gate";
import { DestinationDetail } from "@/components/destination-detail";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = await destinationRepository.getBySlug(slug);
  if (
    place?.uuid &&
    backendConfigured() &&
    canView(place, await viewerTier())
  ) {
    const { data } = await (
      await serverSupabase()
    )
      .from("place_details")
      .select("seo")
      .eq("place_id", place.uuid)
      .maybeSingle();
    const seo = data?.seo as
      { title?: string; description?: string; canonical?: string } | undefined;
    if (seo)
      return {
        title: seo.title || place.title,
        description: seo.description || undefined,
        alternates:
          seo.canonical && /^https:\/\//.test(seo.canonical)
            ? { canonical: seo.canonical }
            : undefined,
      };
  }
  return {
    robots:
      place?.requiredTier === "explorer-plus"
        ? { index: false, follow: false }
        : undefined,
    title:
      place?.requiredTier === "explorer-plus"
        ? "Explorer+ destination"
        : place?.title || "Destination",
  };
}
export default async function PlacePage({ params }: Props) {
  const { slug } = await params;
  const place = await destinationRepository.getBySlug(slug);
  if (!place) {
    if (backendConfigured()) {
      const alias = await (
        await serverSupabase()
      )
        .from("place_redirects")
        .select("places(slug)")
        .eq("slug", slug)
        .maybeSingle();
      const target = alias.data?.places as unknown as { slug: string } | null;
      if (target) permanentRedirect(`/place/${target.slug}/`);
    }
    notFound();
  }
  const tier = await viewerTier();
  if (
    !canView(place, tier) &&
    place.requiredTier === "explorer-plus" &&
    place.slug !== slug
  )
    redirect(`/place/${place.slug}/`);
  if (canView(place, tier) && place.slug !== slug)
    redirect(`/place/${place.slug}/`);
  // Check on the server BEFORE creating a client gallery/map or serializing props.
  return canView(place, tier) ? (
    <DestinationDetail place={place} tier={tier} />
  ) : (
    <DestinationGate place={place} tier={tier} />
  );
}
