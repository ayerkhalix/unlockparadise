import { ValidatedForm } from "./ui/validated-form";
import { cookies } from "next/headers";
import { currentSession } from "@/lib/auth/session";
import { verifyRecoveryGrant } from "@/lib/auth/recovery";
import { OriginalMarkup } from "./original-markup";
import { fragment } from "@/lib/content";
export async function ResetPassword() {
  const current = await currentSession();
  const grant = (await cookies()).get("upd-recovery")?.value || "";
  if (!current || !grant || !verifyRecoveryGrant(grant, current.user.id))
    return <OriginalMarkup html={fragment("reset-password")!} />;
  return (
    <main className="upd-main" id="upd-main">
      <div className="upd-container">
        <div className="upd-primary">
          <div className="upd-auth-card">
            <div className="upd-auth-head">
              <h2 className="upd-auth-head__title">Set a new password</h2>
            </div>
            <ValidatedForm
              className="upd-auth-form"
              data-endpoint="/api/auth/password/"
              data-recovery="true"
              action="/api/auth/password/"
              method="post"
            >
              <label className="upd-auth-field">
                New password
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={200}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="upd-btn upd-btn--primary" type="submit">
                Save password
              </button>
              <p role="status" aria-live="polite" />
            </ValidatedForm>
          </div>
        </div>
      </div>
    </main>
  );
}
