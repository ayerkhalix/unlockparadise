import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { travelPreferences } from "@/lib/repositories/traveler";
import { safeRedirect } from "@/lib/http";
import { TravelerDiscovery } from "@/components/traveler-discovery";
import { findPlaces } from "@/lib/repositories/places";
import { mediaAvailable } from "@/lib/media-availability";
export const metadata: Metadata = { title: "Discover your travel style" };
export default async function TravelerDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const current = await currentSession();
  if (!current) redirect("/login/?redirect_to=%2Ftraveler-discovery%2F");
  const next = safeRedirect((await searchParams).next, "/");
  const destination =
    next.startsWith("/traveler-discovery") ||
    next.startsWith("/login") ||
    next.startsWith("/join")
      ? "/"
      : next;
  const places = await findPlaces({ featured: true, limit: 4 });
  const cover = places
    .flatMap((p) => p.place_media)
    .find((m) => m.kind === "cover" && mediaAvailable(m.media))?.media;
  return (
    <TravelerDiscovery
      userId={current.user.id}
      initial={await travelPreferences(current.db, current.user.id)}
      destination={destination}
      image={cover ? `/api/media/${cover.id}/?variant=large` : undefined}
    />
  );
}
