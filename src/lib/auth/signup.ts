import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/http";

export function requireAccountEmails() {
  if (process.env.AUTH_EMAILS_ENABLED !== "true")
    throw new ApiError(
      503,
      "Account emails are temporarily unavailable. Please try again later.",
    );
}

/** A successful signup always waits for mailbox confirmation. */
export async function signUpWithConfirmation(
  db: SupabaseClient,
  details: { email: string; password: string },
  redirect: string,
) {
  const { data, error } = await db.auth.signUp({
    ...details,
    options: {
      emailRedirectTo: redirect,
      data: { terms_accepted: true },
    },
  });
  if (error) {
    if (
      [
        "email_address_not_authorized",
        "over_email_send_rate_limit",
        "unexpected_failure",
      ].includes(error.code || "")
    )
      throw new ApiError(
        503,
        "Account emails are temporarily unavailable. Please try again later.",
      );
    throw new ApiError(
      400,
      "Registration could not be completed. Check your details or sign in.",
    );
  }
  // Fail closed if the provider is accidentally configured to auto-confirm.
  if (data.session) {
    await db.auth.signOut({ scope: "local" });
    throw new ApiError(
      503,
      "Registration is temporarily unavailable. Please try again later.",
    );
  }
  return { message: "Check your email to confirm your account." };
}
