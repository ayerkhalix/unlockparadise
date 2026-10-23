import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/supabase/config";
import { recoveryGrant } from "@/lib/auth/recovery";
import { safeRedirect } from "@/lib/http";
import { discoveryDestination } from "@/lib/repositories/traveler";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const db = await serverSupabase();
  if (
    token_hash &&
    (type === "recovery" || type === "signup" || type === "email")
  ) {
    const { data, error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error && data.user) {
      if (type === "recovery") {
        (await cookies()).set("upd-recovery", recoveryGrant(data.user.id), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 600,
          path: "/",
        });
        return NextResponse.redirect(appOrigin() + "/reset-password/");
      }
      return NextResponse.redirect(
        appOrigin() + (await discoveryDestination(db)),
      );
    }
  }
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        appOrigin() +
          (await discoveryDestination(
            db,
            safeRedirect(url.searchParams.get("next")),
          )),
      );
  }
  return NextResponse.redirect(appOrigin() + "/login/?error=confirmation");
}
