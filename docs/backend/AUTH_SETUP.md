# Google sign-in and business email

The website integration is implemented. Google sign-in stays unavailable until the Google OAuth client is configured in Supabase. The business email address and SMTP service are still to be supplied; the sender has not been changed. Neither setup needs secrets in browser code.

## Google sign-in

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), select the client's Google Cloud project. Configure Branding with Unlock Paradise, the support contact, website and privacy/terms URLs. Configure Audience; while the app is in Testing, add the Google accounts used for the demo as test users. Public availability depends on Google's publishing/verification requirements.
2. In Data Access, use only `openid`, `https://www.googleapis.com/auth/userinfo.email` and `https://www.googleapis.com/auth/userinfo.profile`.
3. In Clients, create an OAuth client with application type **Web application**. Add these authorized JavaScript origins for staging/development:

   ```text
   https://unlockparadise-staging.vercel.app
   http://127.0.0.1:3000
   http://localhost:3000
   ```

4. The authorized redirect URI in **Google Cloud** is the hosted Supabase callback, even when the website runs locally:

   ```text
   https://namkxlsdjnopixhzrvyl.supabase.co/auth/v1/callback
   ```

5. Open the [client Supabase project's Authentication providers](https://supabase.com/dashboard/project/namkxlsdjnopixhzrvyl/auth/providers). Enable Google, enter the Web client ID and client secret, and save. These credentials are separate from the Maps/Places API key. Do not add the client secret to `NEXT_PUBLIC_*`, commit it, or paste it in chat.
6. In [Supabase URL Configuration](https://supabase.com/dashboard/project/namkxlsdjnopixhzrvyl/auth/url-configuration), set Site URL to `https://unlockparadise-staging.vercel.app`. Add these narrowly scoped redirect allowlist patterns. The trailing `**` allows the per-attempt `flow` query parameter; do not wildcard the domain or the entire site.

   ```text
   https://unlockparadise-staging.vercel.app/auth/callback/**
   http://127.0.0.1:3000/auth/callback/**
   http://localhost:3000/auth/callback/**
   ```

   Keep the existing confirmation and recovery URLs. Development-only origins/redirects should be omitted from a separate production project.

7. Open `/login/` or `/join/`, choose **Continue with Google**, and complete Google's consent. A first-time account must accept our terms, then completes traveler discovery. Existing members keep their database-backed membership. A checkout return starts at `/login/?redirect_to=%2Fcheckout%2F` and is preserved through the flow.
8. Check cancel/back, a fresh attempt after a stale callback, refresh, sign-out, and existing email-account linking using accounts you control. Supabase handles verified identity linking; the app does not manually match arbitrary email strings or import privileges from Google metadata. Existing staff MFA still applies.

The app uses server-side PKCE, a ten-minute signed HttpOnly flow cookie bound to the original browser and callback nonce, safe local return paths, a verified server session and explicit terms acceptance. No Google SDK or One Tap script loads before the user asks to sign in. `AUTH_RECOVERY_SECRET` also signs OAuth state with a separate signature namespace; retain the configured server-only secret of at least 32 characters.

References: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [redirect URL matching](https://supabase.com/docs/guides/auth/redirect-urls), [Google button branding](https://developers.google.com/identity/branding-guidelines).

## Send verification and recovery emails from the business address

This is configured in **Supabase Auth**, not the website's `.env`. A business mailbox address alone is insufficient; the service must permit authenticated SMTP sending from that address.

Have the client supply these in the provider/Supabase dashboard, keeping the password private:

| Setting       | What to enter                                               |
| ------------- | ----------------------------------------------------------- |
| Sender email  | The business address approved by the email service          |
| Sender name   | `Unlock Paradise` (or the client's preferred name)          |
| SMTP host     | The provider's exact outbound SMTP hostname                 |
| SMTP port     | The TLS-compatible port documented by the provider          |
| SMTP username | The provider's SMTP user; sometimes the mailbox address     |
| SMTP password | The provider's SMTP credential or app password, as required |

1. Obtain the above from the business mail host or transactional email service. Verify the sending domain/address there. Follow that provider's SPF/DKIM/DMARC instructions without replacing unrelated DNS records.
2. Open [Supabase Authentication email settings](https://supabase.com/dashboard/project/namkxlsdjnopixhzrvyl/auth/templates), then **SMTP Settings**, and enable custom SMTP. Enter the settings and save. Keep email confirmation enabled. Set a suitable email sending limit in Authentication → Rate Limits for the provider's allowance.
3. Keep the **Confirm sign up** template link compatible with this application's token-hash callback:

   ```html
   <h2>Welcome to Unlock Paradise</h2>
   <p>Confirm your email to finish creating your account.</p>
   <p>
     <a
       href="{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&amp;type=signup"
       >Confirm my email</a
     >
   </p>
   <p>If you did not create this account, you can ignore this email.</p>
   ```

4. Keep the **Reset password** template link:

   ```html
   <h2>Reset your Unlock Paradise password</h2>
   <p>
     <a
       href="{{ .SiteURL }}/auth/confirm/?token_hash={{ .TokenHash }}&amp;type=recovery"
       >Choose a new password</a
     >
   </p>
   <p>If you did not request a reset, you can ignore this email.</p>
   ```

5. If an email OTP flow is enabled separately, its email template uses Supabase's `{{ .Token }}` variable. The same custom SMTP sender applies to Supabase Auth emails, including enabled verification, recovery, email-change and email OTP messages. The website currently uses password signup with confirmation links and password recovery links; this change does not introduce a new email-OTP login screen. Authenticator-app codes, Google's messages and bank/Xendit OTPs are controlled by their issuer.
6. The app's existing email gates still apply: `AUTH_EMAILS_ENABLED=true`; in staging, `AUTH_ALLOWED_EMAILS` must include each approved test inbox. Update Vercel environment values and redeploy only when those approved inboxes change. SMTP credentials belong in Supabase and are not required in Vercel. The SMTP sender change itself requires no app redeployment.
7. To verify delivery, register an approved fresh test inbox and request a recovery email for an approved test account. Confirm the **From** address/name, inbox/spam delivery, SPF/DKIM results and successful confirmation/reset links. Test once per flow rather than repeatedly hitting email rate limits. Do not consider the sender migration complete until the real inbox receives both messages.

Changing SMTP affects future Supabase Auth messages; it does not resend prior messages, change customer passwords, or configure the application's separate membership-notification outbox.

References: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [email templates and OTP variables](https://supabase.com/docs/guides/auth/auth-email-templates).

## First-visit cookies and privacy notice

The first visit shows a compact notice with **Essential only**, **Allow analytics** and **Manage preferences**, linked to the existing Privacy Policy. Optional analytics stays off until explicitly allowed. The existing `upd-analytics-consent` choice is reused, so returning visitors with a saved choice are not prompted again. Privacy preferences remain available in the footer. Browser privacy signals continue to suppress analytics even if it was previously allowed; storage failures keep analytics off for the page session. Required authentication cookies and cart storage are separate from optional measurement.
