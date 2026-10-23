import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { assertStagingFixture } from "./staging-project.mjs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
const ref = process.env.MIGRATION_PROJECT_REF;
if (process.env.UPD_ENVIRONMENT !== "staging" || !url || !ref || new URL(url).hostname !== `${ref}.supabase.co`)
  throw new Error("BLOCKED: pinned staging project required.");
if (!key) throw new Error("BLOCKED: configure SUPABASE_SECRET_KEY locally to create synthetic identities without sending email.");
if (!process.argv.includes("--apply")) { console.log("Dry-run: four synthetic identities, one MFA administrator and active/expired test entitlements. No customer accounts or email."); process.exit(0); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const file = "artifacts/staging-private/identities.json";
await mkdir("artifacts/staging-private", { recursive: true });
let fixture;
try { fixture = JSON.parse(await readFile(file, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; fixture = { project: ref, users: {} }; }
assertStagingFixture(fixture);
const save = () => writeFile(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
const requireSuccess = result => { if (result.error) throw new Error(`Fixture operation failed: ${result.error.code || result.error.status || "unknown"}`); return result.data; };
for (const name of ["explorer", "premium", "expired", "admin"]) {
  const previous = fixture.users[name];
  const email = previous?.email || `upd-${ref.slice(0, 6)}-${name}@unlock-paradise.invalid`;
  if (!email.endsWith("@unlock-paradise.invalid")) throw new Error("Only isolated synthetic identities permitted.");
  const password = previous?.password || randomBytes(32).toString("base64url") + "Aa1!";
  if (!previous?.id) {
    const data = requireSuccess(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { terms_accepted: true, role: "admin", premium: true, synthetic_staging: true } }));
    fixture.users[name] = { id: data.user.id, email, password };
    await save();
  }
  const user = fixture.users[name];
  requireSuccess(await db.from("profiles").update({ display_name: `Staging ${name}` }).eq("id", user.id));
  if (name === "admin") requireSuccess(await db.from("user_roles").upsert({ user_id: user.id, role: "admin" }));
  if (["premium", "expired"].includes(name)) {
    const entitlementId = user.entitlement_id || crypto.randomUUID();
    requireSuccess(await db.from("entitlements").upsert({ id: entitlementId, user_id: user.id, source: "manual", reason: "Synthetic staging acceptance only", starts_at: new Date(Date.now() - 3 * 864e5).toISOString(), expires_at: new Date(Date.now() + (name === "expired" ? -864e5 : 7 * 864e5)).toISOString(), revoked_at: null }));
    user.entitlement_id = entitlementId;
    await save();
  }
}
console.log(JSON.stringify({ project: ref, synthetic_accounts: Object.keys(fixture.users).length, credentials: "Stored only in ignored artifacts/staging-private/identities.json", emails_sent: 0, production_accounts_imported: 0 }));
