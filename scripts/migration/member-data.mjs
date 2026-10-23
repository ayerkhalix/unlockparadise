import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const apply = process.argv.includes("--apply"),
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
const root = "artifacts/backend-private/";
const saved = JSON.parse(await readFile(root + "member-places.json", "utf8")),
  reviews = JSON.parse(await readFile(root + "reviews.json", "utf8")),
  membership = JSON.parse(
    await readFile(root + "legacy-memberships.json", "utf8"),
  );
const content = JSON.parse(
  await readFile(root + "content-manifest.json", "utf8"),
);
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    member_places: saved.length,
    reviews: reviews.length,
    membership_records: membership.length,
  }),
);
if (!apply) process.exit(0);
if (
  process.env.ACCOUNT_MIGRATION_APPROVED !== "true" ||
  process.env.MEMBERSHIP_MIGRATION_APPROVED !== "true"
)
  throw new Error(
    "Explicit identity and membership reconciliation approvals required.",
  );
if (
  process.env.UPD_ENVIRONMENT !== "staging" ||
  !url ||
  !key ||
  new URL(url).hostname.split(".")[0] !== process.env.MIGRATION_PROJECT_REF
)
  throw new Error("Pinned isolated staging required.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const profiles = await db.from("profiles").select("id,legacy_id").limit(1000);
if (profiles.error) throw new Error("Identity lookup failed.");
const users = new Map(profiles.data.map((p) => [p.legacy_id, p.id])),
  places = new Map(content.places.map((p) => [p.legacy_id, p.id]));
const timestamp = (value) =>
  Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null;
let imported = 0,
  deferred = 0;
for (const row of saved) {
  const user_id = users.get(row.legacy_user_id),
    place_id = places.get(row.legacy_place_id);
  if (!user_id || !place_id) {
    deferred++;
    continue;
  }
  const saved_at = timestamp(row.saved_at),
    visited_at = timestamp(row.visited_at);
  if (!saved_at && !visited_at) continue;
  const result = await db
    .from("member_places")
    .upsert(
      { user_id, place_id, saved_at, visited_at },
      { onConflict: "user_id,place_id" },
    );
  if (result.error) throw new Error("Owned collection import failed.");
  imported++;
}
for (const row of reviews) {
  const user_id = users.get(row.legacy_user_id),
    place_id = places.get(row.legacy_place_id);
  if (!user_id || !place_id || row.rating < 1 || row.rating > 5) {
    deferred++;
    continue;
  }
  const result = await db
    .from("reviews")
    .upsert(
      {
        legacy_id: row.legacy_id,
        user_id,
        place_id,
        author_name: row.author_name,
        rating: row.rating,
        title: row.title,
        body: row.body,
        status: row.status,
        created_at: row.created_at,
      },
      { onConflict: "legacy_id" },
    )
    .select("id")
    .single();
  if (result.error) throw new Error("Review import failed.");
  const likes = Array.isArray(row.likes) ? row.likes : [];
  for (const liker of likes) {
    const id = users.get(Number(liker));
    if (id) {
      const like = await db
        .from("review_likes")
        .upsert(
          { review_id: result.data.id, user_id: id },
          { onConflict: "review_id,user_id", ignoreDuplicates: true },
        );
      if (like.error) throw new Error("Review like import failed.");
    }
  }
  imported++;
}
// Existing provider subscriptions are never activated from stale statuses.
// Only reviewed permanent legacy grants and already-paid one-time periods are eligible.
for (const record of membership) {
  const user_id = users.get(record.legacy_user_id);
  if (!user_id) {
    deferred++;
    continue;
  }
  const sub = record.subscription,
    roles = record.roles || {};
  if (!roles.upd_vip) continue;
  const once = sub.kind === "once",
    providerPlan = String(sub.plan_id || "");
  if (providerPlan && !once) {
    deferred++;
    continue;
  }
  const expiry = once ? timestamp(sub.paid_through) : null;
  if (once && (!expiry || Date.parse(expiry) <= Date.now())) continue;
  const reason = "Approved legacy entitlement " + record.legacy_user_id;
  const prior = await db
    .from("entitlements")
    .select("id")
    .eq("user_id", user_id)
    .eq("source", "legacy")
    .eq("reason", reason);
  if (prior.error) throw new Error("Entitlement lookup failed.");
  if (!prior.data.length) {
    const result = await db
      .from("entitlements")
      .insert({ user_id, source: "legacy", expires_at: expiry, reason });
    if (result.error) throw new Error("Legacy entitlement import failed.");
    imported++;
  }
}
console.log(
  JSON.stringify({
    imported,
    deferred,
    emails_sent: 0,
    administrative_roles_imported: 0,
    source_digest: createHash("sha256")
      .update(JSON.stringify({ saved, reviews, membership }))
      .digest("hex"),
  }),
);
if (deferred) process.exitCode = 1;
