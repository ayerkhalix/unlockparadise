import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || process.env.UPD_ENVIRONMENT !== "staging" || new URL(url).hostname !== `${process.env.MIGRATION_PROJECT_REF}.supabase.co`)
  throw new Error("BLOCKED: pinned isolated Supabase staging configuration is required.");
const db = createClient(url, key, { auth: { persistSession: false } });
const report = { project: process.env.MIGRATION_PROJECT_REF, passed: [], failed: [], authenticated: "BLOCKED until synthetic credentials exist" };
async function check(name, action) {
  try { await action(); report.passed.push(name); console.log(`PASSED: ${name}`); }
  catch { report.failed.push(name); console.error(`FAILED: ${name}`); process.exitCode = 1; }
  await writeFile("artifacts/staging-public-results.json", JSON.stringify(report, null, 2));
}
const source = JSON.parse(await readFile("artifacts/backend-private/content-manifest.json", "utf8"));
await check("383 published Places and excluded test absent via live REST", async () => {
  const places = await db.from("places").select("legacy_id", { count: "exact" });
  assert.equal(places.error, null); assert.equal(places.count, 383);
  assert.ok(places.data.every(p => p.legacy_id !== 5693));
});
await check("all four areas and eight categories via live REST", async () => {
  for (const [table, count] of [["areas", 4], ["categories", 8]]) { const result = await db.from(table).select("id", { count: "exact", head: true }); assert.equal(result.error, null); assert.equal(result.count, count); }
});
await check("anonymous Place details and private media hidden by hosted RLS", async () => {
  const details = await db.from("place_details").select("place_id"); assert.equal(details.error, null); assert.equal(details.data.length, 0);
  const images = await db.from("media").select("id").eq("bucket", "destination-private"); assert.equal(images.error, null); assert.equal(images.data.length, 0);
});
await check("viewer_access cannot acquire membership or admin", async () => {
  const access = await db.rpc("viewer_access"); assert.equal(access.error, null); assert.equal(access.data.premium, false); assert.equal(access.data.admin, false);
});
await check("direct role escalation and admin/member RPC access rejected", async () => {
  assert.ok((await db.from("user_roles").insert({ user_id: "00000000-0000-4000-8000-000000000001", role: "admin" })).error);
  assert.ok((await db.rpc("admin_metrics")).error);
  assert.ok((await db.rpc("set_member_place", { pid: source.places[0].id, op: "save" })).error);
});
await check("public teaser references remain visible without private galleries", async () => {
  const place = await db.from("places").select("place_media(kind,media(id,bucket,status))").eq("slug", "100-cafe-moto").single();
  assert.equal(place.error, null);
  assert.equal(place.data.place_media.filter(x => x.kind === "gallery" && x.media).length, 2);
  assert.ok(place.data.place_media.filter(x => x.media).every(x => x.media.bucket === "destination-public"));
});
await check("anonymous Storage upload is denied using a tiny synthetic PNG", async () => {
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  const uploaded = await db.storage.from("destination-public").upload(`staging-denied/${crypto.randomUUID()}.png`, bytes, { contentType: "image/png", upsert: false });
  assert.ok(uploaded.error); assert.ok(["403", "400"].includes(String(uploaded.error.statusCode)));
});
await check("application uses live query data and safe public image resolution", async () => {
  const base = process.env.APP_URL || "http://127.0.0.1:3000";
  const listing = await fetch(base + "/api/v1/places/?search=Mandyukot"); assert.equal(listing.status, 200); assert.ok((await listing.json()).data.length > 0);
  const cover = source.media.find(m => m.bucket === "destination-public" && m.status === "legacy");
  const image = await fetch(base + `/api/media/${cover.id}/?variant=medium_large`, { redirect: "manual" });
  assert.equal(image.status, 307); assert.ok(image.headers.get("location").startsWith(process.env.LEGACY_PUBLIC_MEDIA_BASE_URL));
  const privateImage = source.media.find(m => m.bucket === "destination-private");
  assert.equal((await fetch(base + `/api/media/${privateImage.id}/`)).status, 404);
});
console.log(JSON.stringify({ passed: report.passed.length, failed: report.failed, real_authenticated_sessions: false }));
