# Payment integration

Current checkpoint, 21 October 2026: **Xendit membership test checkout and provider-verified activation have passed locally.** Public webhook delivery still needs an HTTPS staging endpoint. Live payments and merch checkout remain disabled. See [Xendit implementation and evidence](../../XENDIT_INTEGRATION.md).

`PAYMENT_PROVIDER` explicitly selects Xendit or the retained PayMongo implementation. The current local setting is Xendit, restricted to its development key, staging environment and approved test users. The PayMongo notes below describe the earlier sandbox adapter; its provider acceptance has not been executed. Neither adapter creates automatic subscriptions.

Required server-only configuration: `PAYMONGO_SECRET_KEY` with `sk_test_` prefix, webhook signing secret, synthetic Supabase account UUID allowlist and enabled sandbox method types. `PAYMONGO_TEST_METHODS` defaults to the verified legacy `qrph` fallback. Review enabled methods in the actual sandbox dashboard.

`POST /api/payments/checkout/` validates a logged-in allowlisted account, trusted plan/price and application idempotency key. It reserves one open checkout per account before calling PayMongo. Permanent/manual grants and existing recurring accounts cannot create unnecessary purchases. A timeout leaves an ambiguous `creating` record for reconciliation; it never silently repeats a potentially successful provider POST.

`POST /api/payments/paymongo/` verifies HMAC-SHA256 over timestamp plus exact raw body, requires the test signature and `livemode=false`, enforces a five-minute tolerance and limits payload size. Paid events are checked against the provider's retrieved session and a server-created transaction. Amount/currency must match. No browser success redirect or client metadata activates membership.

The service-only `apply_paid_checkout` RPC applies payment, entitlement, subscription, history and outbox changes in one transaction. Replays do not add time or duplicate messages. Unique provider payment IDs prevent reuse across checkouts. Stored raw card data: none. Receipt email is disabled in sandbox checkout requests.

Non-paid events are recorded by ID/type/hash without logging raw payloads or customer data. Refund events are flagged for reconciliation. Automatic financial refund initiation and entitlement adjustment policy remain blocked because the original Core does not establish the necessary refund rules. Operators can revoke trusted access after approved review; no live money operation is exposed.

Sandbox acceptance still required: create an approved synthetic checkout, complete it on PayMongo's test page, inspect signed delivery, verify exactly-once credit, replay the event, test failed/expired payment handling, test outage/timeout recovery and verify refund-event routing. Reconcile unmatched events and ambiguous creating records before a new checkout is offered.

References: [PayMongo hosted checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start), [webhook signature setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), [webhook testing](https://docs.paymongo.com/docs/webhook-testing).
