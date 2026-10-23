import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import {
  authOrigin,
  googleFlowCookie,
  readGoogleFlow,
} from "@/lib/auth/google";
import { discoveryDestination } from "@/lib/repositories/traveler";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = authOrigin(request);
  const jar = await cookies();
  const flow = readGoogleFlow(
    jar.get(googleFlowCookie)?.value || "",
    url.searchParams.get("flow"),
    origin,
  );
  jar.delete(googleFlowCookie);
  function finish(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  let authenticatedDb: Awaited<ReturnType<typeof serverSupabase>> | null = null;
  const failed = async () => {
    // A callback that exchanged a code but failed the remaining account checks
    // must not leave a partially completed sign-in behind.
    if (authenticatedDb) {
      await authenticatedDb.auth.signOut({ scope: "local" }).catch(() => {});
      for (const cookie of jar.getAll()) {
        if (/^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))
          jar.delete(cookie.name);
      }
    }
    return finish(
      `/login/?error=google&redirect_to=${encodeURIComponent(flow?.next || "/account/")}`,
    );
  };
  const code = url.searchParams.get("code");
  if (!flow || !code || code.length > 4096 || url.searchParams.has("error"))
    return failed();
  try {
    const db = await serverSupabase();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (error || !data.user) return failed();
    authenticatedDb = db;
    const verified = await db.auth.getUser();
    if (verified.error || verified.data.user?.id !== data.user.id)
      return failed();
    const profile = await db
      .from("profiles")
      .select("terms_accepted_at")
      .eq("id", data.user.id)
      .single();
    if (profile.error) return failed();
    return finish(
      profile.data.terms_accepted_at
        ? await discoveryDestination(db, flow.next)
        : `/auth/complete-account/?next=${encodeURIComponent(flow.next)}`,
    );
  } catch {
    return failed();
  }
}
