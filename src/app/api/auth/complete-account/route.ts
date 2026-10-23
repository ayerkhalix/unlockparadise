import { z } from "zod";
import { api, databaseError, input, json, verifyOrigin } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { googleReturnPath } from "@/lib/auth/google";
import { privilegedSupabase } from "@/lib/supabase/server";
import { discoveryDestination } from "@/lib/repositories/traveler";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireSession(request);
    const body = await input(
      request,
      z.object({
        terms: z.union([z.literal("1"), z.literal(true)]),
        redirect_to: z.string().max(2000).optional(),
      }),
      4096,
    );
    await rateLimit("auth:terms", current.user.id, 10);
    // This protected column has no browser UPDATE grant. Only the verified owner
    // is updated here; account roles and membership are never taken from OAuth.
    const { error } = await privilegedSupabase()
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", current.user.id)
      .is("terms_accepted_at", null);
    databaseError(error);
    return json({
      redirect_to: await discoveryDestination(
        current.db,
        googleReturnPath(body.redirect_to),
      ),
    });
  });
}
