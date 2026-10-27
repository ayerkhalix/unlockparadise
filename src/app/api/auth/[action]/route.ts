import { z } from "zod";
import { cookies } from "next/headers";
import {
  api,
  ApiError,
  input,
  json,
  safeRedirect,
  verifyOrigin,
} from "@/lib/http";
import { serverSupabase } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/supabase/config";
import { requireSession } from "@/lib/auth/session";
import { verifyRecoveryGrant } from "@/lib/auth/recovery";
import { rateLimit } from "@/lib/rate-limit";
import { discoveryDestination } from "@/lib/repositories/traveler";
import { registrationInput } from "@/lib/auth/registration";
import {
  requireAccountEmails,
  signUpWithConfirmation,
} from "@/lib/auth/signup";
const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
  redirect_to: z.string().optional(),
  terms: z.union([z.literal("1"), z.literal(true)]).optional(),
});
const address = z.object({ email: z.email().max(254) });
const password = z.string().min(8).max(200);
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  return api(async () => {
    verifyOrigin(request);
    const { action } = await params;
    const db = await serverSupabase(request);
    if (action === "login" || action === "join") {
      const body =
        action === "join"
          ? await input(request, registrationInput)
          : await input(request, credentials);
      await rateLimit("auth:" + action, body.email.toLowerCase(), 10);
      if (action === "join") {
        if (!body.terms)
          throw new ApiError(400, "Accept the Terms and Privacy Policy.");
        requireAccountEmails();
        await rateLimit(
          "auth:join:ip",
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "local",
          20,
          3600,
        );
        return json(
          await signUpWithConfirmation(
            db,
            {
              email: body.email,
              password: body.password,
            },
            appOrigin() + "/auth/confirm/",
          ),
        );
      }
      const { error } = await db.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error)
        throw new ApiError(
          401,
          "Email or password is incorrect, or email confirmation is required.",
        );
      return json({
        redirect_to: await discoveryDestination(
          db,
          safeRedirect("redirect_to" in body ? body.redirect_to : undefined),
        ),
      });
    }
    if (action === "forgot-password") {
      const body = await input(request, address);
      requireAccountEmails();
      await rateLimit(
        "recovery:ip",
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "local",
        10,
        3600,
      );
      await rateLimit("recovery", body.email.toLowerCase(), 3, 3600);
      const { error } = await db.auth.resetPasswordForEmail(body.email, {
        redirectTo: appOrigin() + "/auth/confirm/",
      });
      if (error)
        throw new ApiError(
          503,
          "Password recovery is temporarily unavailable.",
        );
      return json({
        message: "If an account exists, a reset link will arrive shortly.",
      });
    }
    const current = await requireSession(request);
    if (action === "logout") {
      const { error } = await current.db.auth.signOut({ scope: "local" });
      if (error)
        throw new ApiError(
          503,
          "Sign out could not be completed. Please try again.",
        );
      return json({ redirect_to: "/" });
    }
    if (action === "password") {
      const body = await input(
        request,
        z.object({
          password,
          current_password: z.string().optional(),
          recovery: z.boolean().optional(),
        }),
      );
      if (body.recovery) {
        const grant = (await cookies()).get("upd-recovery")?.value || "";
        if (!verifyRecoveryGrant(grant, current.user.id))
          throw new ApiError(403, "Use a fresh password recovery link.");
      } else {
        if (!body.current_password || !current.user.email)
          throw new ApiError(400, "Enter your current password.");
        const check = await current.db.auth.signInWithPassword({
          email: current.user.email,
          password: body.current_password,
        });
        if (check.error)
          throw new ApiError(403, "Current password is incorrect.");
      }
      const { error } = await current.db.auth.updateUser({
        password: body.password,
      });
      if (error)
        throw new ApiError(
          400,
          "Password could not be updated. Choose a different password.",
        );
      (await cookies()).delete("upd-recovery");
      return json({ message: "Password changed.", redirect_to: "/account/" });
    }
    if (action === "mfa") {
      const body = await input(
        request,
        z.discriminatedUnion("op", [
          z.object({ op: z.literal("list") }),
          z.object({ op: z.literal("enroll") }),
          z.object({
            op: z.literal("verify"),
            factor_id: z.string().uuid(),
            code: z.string().regex(/^\d{6}$/),
          }),
        ]),
      );
      if (body.op === "list") {
        const { data, error } = await current.db.auth.mfa.listFactors();
        if (error) throw new ApiError(400, "Could not load MFA factors.");
        return json({
          factors: data.totp.map((f) => ({
            id: f.id,
            status: f.status,
            friendly_name: f.friendly_name,
          })),
        });
      }
      if (body.op === "enroll") {
        const { data, error } = await current.db.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Unlock Paradise admin",
        });
        if (error)
          throw new ApiError(
            400,
            "Could not enroll MFA. Use an existing factor if already enrolled.",
          );
        return json({
          id: data.id,
          qr_code: data.totp.qr_code,
          secret: data.totp.secret,
        });
      }
      await rateLimit("mfa", current.user.id, 10, 600);
      const { error } = await current.db.auth.mfa.challengeAndVerify({
        factorId: body.factor_id,
        code: body.code,
      });
      if (error) throw new ApiError(403, "Invalid verification code.");
      return json({ redirect_to: "/admin/" });
    }
    throw new ApiError(404, "Unknown account operation.");
  });
}
