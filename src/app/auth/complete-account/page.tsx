import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { googleReturnPath } from "@/lib/auth/google";
import { databaseError } from "@/lib/http";
import { discoveryDestination } from "@/lib/repositories/traveler";
import { AuthBrand, TermsConsent } from "@/components/auth-form";

export const metadata: Metadata = { title: "Complete your account" };
export default async function CompleteAccount({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = googleReturnPath((await searchParams).next);
  const current = await currentSession();
  if (!current) redirect(`/login/?redirect_to=${encodeURIComponent(next)}`);
  const profile = await current.db
    .from("profiles")
    .select("terms_accepted_at")
    .eq("id", current.user.id)
    .single();
  databaseError(profile.error);
  if (profile.data?.terms_accepted_at)
    redirect(await discoveryDestination(current.db, next));
  return (
    <main id="upd-main" className="p2-auth-page" aria-labelledby="auth-title">
      <div className="p2-auth-card">
        <AuthBrand />
        <h1 id="auth-title">One last step</h1>
        <p className="p2-muted">
          Review our terms to finish creating your Unlock Paradise account.
        </p>
        <form
          noValidate
          className="p2-auth-form"
          action="/api/auth/complete-account/"
          method="post"
          data-endpoint="/api/auth/complete-account/"
        >
          <input type="hidden" name="redirect_to" value={next} />
          <TermsConsent />
          <p className="p2-auth-status" role="status" aria-live="polite" />
          <button
            type="submit"
            className="p2-button"
            data-pending-label="Saving…"
          >
            Agree and continue
          </button>
        </form>
        <form
          noValidate
          className="p2-auth-form p2-auth-alt"
          action="/api/auth/logout/"
          method="post"
          data-endpoint="/api/auth/logout/"
        >
          <button
            type="submit"
            className="p2-button p2-button--quiet"
            data-pending-label="Signing out…"
          >
            Sign out instead
          </button>
          <p className="p2-auth-status" role="status" aria-live="polite" />
        </form>
      </div>
    </main>
  );
}
