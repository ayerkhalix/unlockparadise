import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { configuration, connect } from "./project-database.mjs";

const { TARGET, env } = await configuration();
const fixture = JSON.parse(
  await readFile("artifacts/staging-private/identities.json", "utf8"),
);
assert.equal(fixture.project, "iitblbdqztuxdzpaetie");
const url = env.MIGRATION_TARGET_SUPABASE_URL;
assert.equal(url, `https://${TARGET.ref}.supabase.co`);
const client = () =>
  createClient(url, env.MIGRATION_TARGET_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "")]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(
    (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  return ((h.readUInt32BE(h[19] & 15) & 0x7fffffff) % 1e6)
    .toString()
    .padStart(6, "0");
}
const checks = [],
  sessions = [],
  db = connect(TARGET);
function passed(name) {
  checks.push(name);
  console.log(JSON.stringify({ passed: name }));
}
try {
  const anon = client();
  const signed = {};
  for (const role of ["explorer", "premium", "admin"]) {
    const identity = fixture.users[role],
      api = client();
    const { data, error } = await api.auth.signInWithPassword({
      email: identity.email,
      password: identity.password,
    });
    assert.ok(!error, `${role} password sign-in failed`);
    assert.equal(data.user.id, identity.id);
    if (identity.factor) {
      const result = await api.auth.mfa.challengeAndVerify({
        factorId: identity.factor.id,
        code: totp(identity.factor.secret),
      });
      assert.ok(!result.error, `${role} migrated MFA failed`);
      const assurance = await api.auth.mfa.getAuthenticatorAssuranceLevel();
      assert.equal(assurance.data.currentLevel, "aal2");
      passed("existing admin authenticator preserved");
    }
    signed[role] = api;
    sessions.push(api);
    passed(`${role} existing password and UUID preserved`);
  }
  const media =
    await db`select distinct m.id,m.bucket,m.object_path,m.checksum from public.media m join public.place_media pm on pm.media_id=m.id join public.places p on p.id=pm.place_id where p.vip_content and m.status='ready' and m.bucket='destination-private' order by m.id limit 1`;
  const variants =
    await db`select distinct f.id,f.bucket,f.object_path,f.checksum from public.media_files f join public.place_media pm on pm.media_id=f.media_id join public.places p on p.id=pm.place_id where p.vip_content and f.status='ready' and f.bucket='destination-private' order by f.id limit 1`;
  assert.equal(media.length, 1, "Protected primary sample required");
  assert.equal(variants.length, 1, "Protected variant sample required");
  for (const [role, api] of [
    ["guest", anon],
    ["explorer", signed.explorer],
  ]) {
    const raw = await api.from("places").select("id").eq("vip_content", true);
    assert.ok(!raw.error);
    assert.equal(raw.data.length, 0);
    const cards = await api.rpc("browse_places", { max_results: 500 });
    assert.ok(!cards.error);
    const locked = cards.data.filter((p) => p.vip_content);
    assert.ok(locked.length > 0);
    assert.ok(
      locked.every(
        (p) =>
          p.title === "Explorer+ destination" &&
          p.slug === p.id &&
          !p.assets.length &&
          !p.place_media.length,
      ),
    );
    for (const object of [...media, ...variants]) {
      const result = await api.storage
        .from(object.bucket)
        .createSignedUrl(object.object_path, 60);
      assert.ok(result.error, "Protected object unexpectedly accessible");
    }
    passed(`${role} cannot read protected names images or variants`);
  }
  for (const object of [...media, ...variants]) {
    const result = await signed.premium.storage
      .from(object.bucket)
      .createSignedUrl(object.object_path, 60);
    assert.ok(!result.error, "Explorer+ signed image failed");
    const response = await fetch(result.data.signedUrl);
    assert.equal(response.status, 200);
    assert.equal(
      createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex"),
      object.checksum,
    );
    const publicResponse = await fetch(
      `${url}/storage/v1/object/public/${object.bucket}/${object.object_path}`,
    );
    assert.ok(
      publicResponse.status >= 400,
      "Private bucket leaked through a public URL",
    );
  }
  passed("Explorer+ private originals and size variants verified");
  const archive =
    await db`select bucket,object_path from public.media_files where bucket='media-archive' and status='ready' limit 1`;
  assert.equal(archive.length, 1);
  const denied = await signed.premium.storage
    .from(archive[0].bucket)
    .createSignedUrl(archive[0].object_path, 60);
  assert.ok(denied.error);
  const allowed = await signed.admin.storage
    .from(archive[0].bucket)
    .createSignedUrl(archive[0].object_path, 60);
  assert.ok(!allowed.error);
  passed("original archive restricted to staff");
  const today = new Date().toISOString().slice(0, 10);
  const analytics = await signed.admin.rpc("admin_analytics", {
    first_day: today,
    last_day: today,
  });
  assert.ok(!analytics.error);
  passed("admin panel database access with MFA");
  const unsafeTables =
    await db`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`;
  assert.equal(unsafeTables.length, 0);
  const unsafeFunctions =
    await db`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype) and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute')) and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`;
  assert.equal(unsafeFunctions.length, 0);
  passed(
    "public tables have RLS and privileged RPCs deny guest and member execution",
  );
  await writeFile(
    "artifacts/client-migration/smoke-tests.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        target: TARGET.ref,
        status: "passed",
        checks,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
} finally {
  for (const api of sessions) await api.auth.signOut({ scope: "local" });
  await db.end({ timeout: 3 });
}
