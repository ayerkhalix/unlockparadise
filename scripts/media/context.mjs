import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
export async function mediaContext() {
  const env = parseEnv(await readFile(".env.local", "utf8"));
  const migration = parseEnv(await readFile(".env.migration.local", "utf8"));
  const ref = "namkxlsdjnopixhzrvyl";
  if (
    env.UPD_ENVIRONMENT !== "staging" ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`
  )
    throw Error("Pinned staging environment required");
  const target = new URL(migration.MIGRATION_TARGET_DB_URL);
  if (
    target.hostname !== `db.${ref}.supabase.co` &&
    !(
      target.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(target.username) === `postgres.${ref}`
    )
  )
    throw Error("Wrong database");
  // The saved direct host is IPv6-only; use this project's verified session pooler.
  if (target.hostname.startsWith("db.")) {
    target.hostname = "aws-0-ap-south-1.pooler.supabase.com";
    target.username = `postgres.${ref}`;
    target.port = "5432";
  }
  return {
    db: postgres(target.toString(), {
      max: 1,
      prepare: false,
      ssl: "require",
      connect_timeout: 20,
      onnotice: () => {},
    }),
    storage: createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  };
}
