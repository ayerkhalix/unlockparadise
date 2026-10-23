// Real identities are deliberately gated. Synthetic creation never sends email.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
const apply = process.argv.includes("--apply"),
  synthetic = process.argv.includes("--synthetic");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
const source = process.argv.find((x) => x.startsWith("--input="))?.slice(8);
const records = synthetic
  ? [
      {
        legacy_id: 900000001,
        email: "explorer-migration@example.test",
        display_name: "Synthetic Explorer",
      },
    ]
  : source
    ? JSON.parse(await readFile(source, "utf8"))
    : [];
if (!records.length)
  throw new Error(
    "Supply --synthetic or a private, reviewed identity manifest.",
  );
if (
  new Set(records.map((x) => x.legacy_id)).size !== records.length ||
  new Set(records.map((x) => x.email.toLowerCase())).size !== records.length
)
  throw new Error("Duplicate source identities.");
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    synthetic,
    count: records.length,
    emails_sent: 0,
  }),
);
if (!apply) process.exit(0);
if (!synthetic && process.env.ACCOUNT_MIGRATION_APPROVED !== "true")
  throw new Error(
    "Real identity migration requires explicit developer approval.",
  );
if (
  process.env.UPD_ENVIRONMENT !== "staging" ||
  !url ||
  !key ||
  !process.env.MIGRATION_PROJECT_REF ||
  new URL(url).hostname.split(".")[0] !== process.env.MIGRATION_PROJECT_REF
)
  throw new Error("Pinned isolated staging required.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [];
for (let page = 1; ; page++) {
  const result = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (result.error) throw new Error("Cannot reconcile existing identities.");
  users.push(...result.data.users);
  if (result.data.users.length < 100) break;
}
let created = 0,
  mapped = 0;
for (const record of records) {
  if (synthetic && !record.email.endsWith("@example.test"))
    throw new Error("Synthetic domain required.");
  const linked = await db
    .from("profiles")
    .select("id")
    .eq("legacy_id", record.legacy_id)
    .maybeSingle();
  if (linked.error) throw new Error("Mapping lookup failed.");
  if (linked.data) {
    mapped++;
    continue;
  }
  const existing = users.find(
    (u) => u.email?.toLowerCase() === record.email.toLowerCase(),
  );
  // Do not attach a legacy identity to an independently registered account without review.
  if (existing)
    throw new Error(
      "Email collision requires manual identity verification; no record was changed.",
    );
  const result = await db.auth.admin.createUser({
    email: record.email,
    password: randomBytes(48).toString("base64url"),
    email_confirm: synthetic,
    user_metadata: { migration_source: "wordpress" },
  });
  if (result.error || !result.data.user)
    throw new Error("Identity creation failed; inspect Auth logs privately.");
  const update = await db
    .from("profiles")
    .update({ legacy_id: record.legacy_id, display_name: record.display_name,terms_accepted_at:record.terms_accepted_at||null })
    .eq("id", result.data.user.id);
  if (update.error)
    throw new Error("Identity created but mapping requires reconciliation.");
  users.push(result.data.user);
  created++;
}
console.log(
  JSON.stringify({
    created,
    already_mapped: mapped,
    emails_sent: 0,
    password_hashes_imported: 0,
  }),
);
