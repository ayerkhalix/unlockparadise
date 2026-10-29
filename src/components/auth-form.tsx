import { GoogleSignIn } from "./google-sign-in";
import { PasswordField } from "./ui/password-field";
type AuthRoute = "login" | "join" | "forgot-password";

export function AuthBrand() {
  return (
    <a className="p2-auth-brand" href="/" aria-label="Unlock Paradise home">
      <img
        src="/original/wp-content/uploads/2026/07/upd-mark-white-header-300x300.png"
        width="48"
        height="48"
        alt=""
      />
      <span>Unlock Paradise</span>
    </a>
  );
}
export function TermsConsent() {
  return (
    <label className="p2-auth-consent">
      <input name="terms" type="checkbox" value="1" required />
      <span>
        I agree to the{" "}
        <a href="/terms/" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy-policy/" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}

export function AuthForm({
  route,
  next = "/account/",
  error,
}: {
  route: AuthRoute;
  next?: string;
  error?: string;
}) {
  const joining = route === "join";
  const recovery = route === "forgot-password";
  const title = joining
    ? "Create your account"
    : recovery
      ? "Reset your password"
      : "Sign in";
  return (
    <main id="upd-main" className="p2-auth-page" aria-labelledby="auth-title">
      <div className="p2-auth-card">
        <AuthBrand />
        <h1 id="auth-title">{title}</h1>
        <p className="p2-muted">
          {joining
            ? "Save your discoveries and plan your next Palawan adventure."
            : recovery
              ? "We’ll email you a link to choose a new password."
              : "Welcome back. Your next adventure starts here."}
        </p>
        {error && (
          <p className="p2-auth-status" role="alert">
            {error === "google"
              ? "Google sign-in was canceled or could not be completed. Try again in this browser, or use email and password."
              : "That confirmation link could not be verified. Use a fresh link or sign in."}
          </p>
        )}
        <form
          noValidate
          className="p2-auth-form"
          action={`/api/auth/${route}/`}
          method="post"
          data-endpoint={`/api/auth/${route}/`}
        >
          <input type="hidden" name="redirect_to" value={next} />
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
          />
          {!recovery && (
            <>
              <label htmlFor="auth-password">Password</label>
              <PasswordField
                id="auth-password"
                name="password"
                autoComplete={joining ? "new-password" : "current-password"}
                minLength={joining ? 12 : 8}
                maxLength={200}
                aria-describedby={joining ? "auth-password-help" : undefined}
                required
              />
              {joining && (
                <>
                  <p id="auth-password-help" className="p2-auth-help">
                    Use at least 12 characters. A unique passphrase or a
                    password manager works well.
                  </p>
                  <label htmlFor="auth-confirm-password">
                    Confirm password
                  </label>
                  <PasswordField
                    id="auth-confirm-password"
                    name="confirm_password"
                    autoComplete="new-password"
                    maxLength={200}
                    data-match-password="password"
                    required
                  />
                </>
              )}
            </>
          )}
          {joining ? (
            <TermsConsent />
          ) : (
            !recovery && (
              <a className="p2-auth-forgot" href="/forgot-password/">
                Forgot password?
              </a>
            )
          )}
          <p className="p2-auth-status" role="status" aria-live="polite" />
          <button
            type="submit"
            className="p2-button"
            data-pending-label={
              joining
                ? "Creating account…"
                : recovery
                  ? "Sending link…"
                  : "Signing in…"
            }
          >
            {joining
              ? "Create account"
              : recovery
                ? "Send reset link"
                : "Sign in"}
          </button>
        </form>
        {!recovery && <GoogleSignIn next={next} />}
        <p className="p2-auth-alt">
          {joining ? (
            <>
              Already have an account?{" "}
              <a href={`/login/?redirect_to=${encodeURIComponent(next)}`}>
                Sign in
              </a>
            </>
          ) : recovery ? (
            <a href="/login/">Back to sign in</a>
          ) : (
            <>
              New to Unlock Paradise?{" "}
              <a href={`/join/?redirect_to=${encodeURIComponent(next)}`}>
                Register free
              </a>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
