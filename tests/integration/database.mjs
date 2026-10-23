import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
export async function database() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;`);
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    try {
      await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
    } catch (error) {
      console.error("Migration failed:", name, error.message);
      throw error;
    }
  }
  return db;
}
export async function asUser(
  db,
  id,
  sql,
  aal = "aal1",
  role = "authenticated",
) {
  await db.exec(
    `set role ${role}; select set_config('request.jwt.claim.sub','${id || ""}',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: id, aal, role })}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
if (process.argv[1]?.endsWith("database.mjs")) {
  const db = await database();
  const result = await db.query(
    "select count(*)::int as count from pg_tables where schemaname='public' and rowsecurity",
  );
  assert.ok(result.rows[0].count >= 25);
  console.log(
    `Applied all migrations; ${result.rows[0].count} public tables have RLS.`,
  );
  await db.close();
}
