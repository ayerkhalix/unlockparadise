import { z } from "zod";
import { cookies } from "next/headers";
import { api, ApiError, input, json, verifyOrigin } from "@/lib/http";
import { serverSupabase } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  authOrigin,
  googleAuthorizeUrl,
  googleFlowCookie,
  googleFlowSeconds,
  googleProviderEnabled,
  issueGoogleFlow,
} from "@/lib/auth/google";

export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const body = await input(
      request,
      z.object({ redirect_to: z.string().max(2000).optional() }),
      4096,
    );
    await rateLimit(
      "auth:google",
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
      20,
    );
    try {
      if (!(await googleProviderEnabled()))
        throw new ApiError(
          503,
          "Google sign-in is not available yet. Please use email and password.",
        );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "Google sign-in is temporarily unavailable. Please try again or use email and password.",
      );
    }
    const origin = authOrigin(request);
    const { flow, cookie } = issueGoogleFlow(body.redirect_to, origin);
    const callback = new URL("/auth/callback/", origin);
    callback.searchParams.set("flow", flow.nonce);
    const db = await serverSupabase();
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.href,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url)
      throw new ApiError(
        503,
        "Google sign-in could not start. Please try again.",
      );
    const redirect_to = googleAuthorizeUrl(data.url);
    (await cookies()).set(googleFlowCookie, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: googleFlowSeconds,
    });
    return json({ redirect_to });
  });
}
