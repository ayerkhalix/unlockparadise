# Membership logic

The executable Core code is authoritative: `policy.php`, `subscription.php`, `paymongo-api.php` and `billing-once.php` under `includes/membership/`.

Explorer is any authenticated account. Explorer+ requires a trusted entitlement, independent of administrative roles and user-editable metadata. Verified staff at AAL2 can inspect all content. A staff role without MFA cannot manage the site or use that role to unlock premium access.

`vip_content` restricts a destination. `premium_content` is retained separately and never substituted for it. Ordinary Place details are member-walled by default; feeds and approved reviews remain public. The `place_gate` setting supports the verified legacy public variant.

Prices: 5,000 centavos for one calendar month, 13,500 for three months, 42,000 for twelve months, PHP. One-time checkout is the implemented source flow. Auto-renew explicitly returns unavailable in Core and is not offered by the replacement.

Crediting a paid checkout locks its transaction and account. New paid time starts from `max(now, paid_through)`. The SQL calendar helper preserves PHP month-overflow semantics, including January 31 plus one month. Unique session/payment/event IDs prevent duplicate crediting. Successful renewals extend one one-time subscription and its entitlement, with an audit/history/outbox entry.

An entitlement must have started, be unrevoked and unexpired. Payment-derived grants additionally need a trusted subscription with valid paid-through and an accepted paid/cancelled state. Pending, past-due, refunded, lapsed and revoked states do not grant new paid access. A cancelled record retains only its already-paid remaining time. Manual/permanent grants require administrator authorization and a reason.

The old recurring resolver permits active/past-due roles without an expiration check, while provider synchronization is a stub. That behavior conflicts with the requested security requirements. Existing recurring records must be reconciled with the provider before access is granted; they are not silently converted into permanent entitlements.

Portfolio means the member's private visited-place list. Bucketlist and Visited are Explorer+ features. Marking visited clears saved; later saving a visited Place is allowed. Unsave/unvisit remove only the chosen flag and delete the row when both are absent.

Expiry is checked on every protected read, so a missed scheduled job does not extend access. The scheduler queues renewal reminders three days before expiration and one expiration message per paid-through value. Delivery remains blocked pending an approved transactional provider. Refund policy and existing recurring-payment continuity require explicit business/provider verification.
