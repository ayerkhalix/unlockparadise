# Xendit membership test integration

21 October 2026. The local application uses Xendit Payment Sessions for fixed-duration Explorer+ test purchases. Merchandise ordering remains closed: the owner has not supplied stock counts or a shipping rule. Live payments and recurring billing are not enabled.

## Configuration

Server-only settings: `PAYMENT_PROVIDER=xendit`, `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, and `XENDIT_TEST_USER_IDS`. The configured key must have the `xnd_development_` prefix and `UPD_ENVIRONMENT` must be `staging`. Both the API and the checkout form enforce the approved-account boundary. `.env.local` and synthetic credentials remain ignored by Git; no credentials are needed in browser code.

The existing synthetic Explorer and expired-member accounts are allowlisted, along with one separate synthetic payment account stored under ignored `artifacts/staging-private/`. Accounts with permanent access or staff roles cannot buy an unnecessary membership. Repeated fixed-duration purchases extend existing paid time. The existing calendar-month billing semantics are preserved.

## Checkout and confirmation

- `POST /api/payments/checkout/` selects the explicit server-side provider. Xendit preparation locks the profile, reads the active plan from the database, and snapshots its price and duration. Client-supplied price fields are rejected.
- Only the request that creates a reservation can POST a new Xendit session. Retries reuse the existing checkout. A definitive provider rejection marks the reservation failed; an ambiguous timeout/5xx retains `creating` for operator reconciliation instead of risking a duplicate session.
- Xendit uses PHP units; local amounts remain integer centavos. Hosted links are restricted to the documented test hosts. No customer email address or phone number is sent when preparing this synthetic test checkout. Hosted checkout owns payment-method entry; the application does not accept card numbers.
- `POST /api/payments/xendit/` validates `x-callback-token`, bounds the body, and verifies the session through Xendit's authenticated API. Completed sessions additionally require a successful captured payment with matching session reference, merchant business, payment/request IDs, country, currency and exact captured total.
- A service-only database transaction updates payment, subscription, entitlement, history and outbox records atomically. Provider boundaries prevent PayMongo/Xendit cross-crediting. Stable provider/session/state event identities deduplicate webhook retries and status checks. Expiry grants no access; a verified late capture may still be credited. An expired notification never downgrades an already-paid checkout.
- `POST /api/payments/reconcile/` requires authentication, origin validation, rate limiting and ownership. It uses the same provider verification as the webhook. The checkout page's **Check payment status** action supports local testing without a public callback. A return URL or browser claim never activates access.
- HTTPS `APP_URL` supplies return URLs. For the current loopback origin those optional URLs are omitted; return manually to `/checkout/` to check payment. Nothing redirects to the live WordPress site.

The success return now includes its transaction ID. The website selects that transaction under the authenticated owner's RLS boundary and automatically verifies pending payment through the same reconciliation endpoint. A verified paid return or successful manual check displays a five-second countdown to Account, with immediate View membership and Stay on this page controls. A normal checkout visit with an old paid transaction does not start a countdown. Invalid or foreign return IDs cannot start one. Xendit's hosted receipt is provider-owned: its exact delay is not configured by this integration, and automatic provider-to-site return remains unavailable on the current HTTP loopback origin. New HTTPS sessions use this return flow; existing sessions keep their original provider settings.

The additive migration is `supabase/migrations/20261021103000_xendit_membership_sandbox.sql`. It extends the existing payment tables and preserves the PayMongo RPC contract. No existing customer, destination, merchandise or saved-trip data is migrated or removed.

## Verified provider behavior

Evidence is under ignored `artifacts/xendit/`.

Executed checks: 99/99 backend tests; 19/19 applicable public/payment browser checks across desktop and phone emulation, with three intentional offline/viewport skips; type checking, ESLint, production build and release-secret scan passed. The payment screens also passed axe and overflow assertions. The Premium static audit retains the same eight pre-existing delegated/library-handler parser findings; its strict exit is not a clean pass.

The actual Xendit test API created a ₱50 monthly membership session. Hosted checkout displayed the correct merchant/product/price and generated a QR Ph payment request. Xendit's official test simulation endpoint completed that payment. Before confirmation the synthetic account remained a free Explorer. Local HTTP delivery to the webhook endpoint fetched the actual completed session and captured payment, then activated Explorer+.

The same notification delivered again did not extend expiry or duplicate the entitlement, membership history or outbox entry. A foreign merchant business was rejected. Pending payment reconciliation, session reuse, invalid tokens and client price rejection also passed against the running app. No real money or customer email was sent.

This proves the provider checkout and application confirmation path. **It does not prove public Xendit-to-website webhook delivery.** A stable public HTTPS staging URL or approved development tunnel is still required. In the Xendit Test Mode dashboard, configure Payment Session **Completed** and **Expired** notifications to `https://<staging-host>/api/payments/xendit/`, then execute Test & Save and an actual sandbox payment delivery. Keep the verification token server-only. Do not use the existing live WordPress hostname for these callbacks.

## Operational limits

For a local client demonstration, sign in with the allowlisted free Explorer test account, open `/checkout/`, select the monthly plan, and continue to Xendit. Select **QR Ph**, then **Pay with QR Ph** to generate its test payment request. In a project terminal run `npm run demo:xendit -- simulate`. The local operator tool selects only that approved synthetic account's latest matching test session, calls Xendit's test-only simulation API, and does not directly grant membership. Return to `/checkout/` and use **Check payment status**; the server independently verifies capture before activation. `npm run demo:xendit` reads the latest demo payment status without simulating anything. Use `--account=expired` only when deliberately demonstrating the expired fixture; the default is the free Explorer fixture. The helper and private login file are for local operators, not a public website simulator.

An ambiguous `creating` checkout requires checking the Xendit dashboard by its transaction reference. Attach/reconcile a matching session only after verifying its reference, business, amount and test mode; never clear it and blindly create another payment. A public scheduler/outage reconciliation job is not configured in this local phase.

Refund initiation and automated refund/entitlement policy are outside this fixed-duration test flow. Unknown callback topics do not activate access. No live key, automatic renewal, merchant payout, shipping charge or inventory count is inferred from the test integration. Existing notification delivery remains disabled; the transaction only schedules an idempotent outbox record.

## References

- [Create a Payment Session](https://docs.xendit.co/apidocs/create-session)
- [Retrieve a Payment Session](https://docs.xendit.co/apidocs/get-session)
- [Payment Session notifications](https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session)
- [Retrieve a captured payment](https://docs.xendit.co/apidocs/get-payment/)
- [Test-only payment simulation](https://docs.xendit.co/apidocs/simulate-payment-test-mode)

The live API rejects an empty `notification_channels` array, despite the documentation presenting it as an optional array. The request omits that field and supplies no customer email. Completed session responses may omit `expires_at`; session association accepts that absence without using an invented expiry. Current responses also expose `latest_payment_request_id`, supported alongside the completed session's payment request ID.
