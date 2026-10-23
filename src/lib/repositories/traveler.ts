import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { databaseError, safeRedirect } from "@/lib/http";
import { currentSession } from "@/lib/auth/session";
import type { TravelPreferences, PublicTravelerBadge } from "@/lib/traveler";

export async function travelPreferences(
  db: SupabaseClient,
  userId: string,
): Promise<TravelPreferences | null> {
  const result = await db
    .from("traveler_preferences")
    .select(
      "user_id,interests,pace,style,companion,public_badges,status,archetype,version,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(result.error);
  return result.data;
}
export async function ownTravelPreferences() {
  const current = await currentSession();
  return current ? travelPreferences(current.db, current.user.id) : null;
}
export async function publicTravelerBadges(
  db: SupabaseClient,
  reviewIds: string[],
): Promise<PublicTravelerBadge[]> {
  if (!reviewIds.length) return [];
  const result = await db.rpc("public_traveler_badges", {
    review_ids: reviewIds.slice(0, 100),
  });
  databaseError(result.error);
  return result.data || [];
}
// Run only after verified authentication, never in a global redirect middleware.
export async function discoveryDestination(
  db: SupabaseClient,
  requested: unknown = "/account/",
) {
  const destination = safeRedirect(requested);
  if (
    /^\/admin(?:\/|\?|$)/.test(destination) ||
    destination.startsWith("/traveler-discovery")
  )
    return destination;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return destination;
  const role = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  databaseError(role.error);
  if (role.data) return destination; // Includes staff at AAL1, before MFA.
  const preferences = await travelPreferences(db, auth.user.id);
  return preferences?.status === "pending"
    ? `/traveler-discovery/?next=${encodeURIComponent(destination)}`
    : destination;
}
