import { readFile } from "node:fs/promises";
import { mediaContext } from "./context.mjs";
const { db } = await mediaContext();
try {
  await readFile("artifacts/performance-optimization/data-before.json");
  const version = "20261027032431";
  const applied =
    await db`select version from supabase_migrations.schema_migrations where version=${version}`;
  if (!applied.length) {
    const source = await readFile(
      `supabase/migrations/${version}_image_delivery_and_uploads.sql`,
      "utf8",
    );
    await db.begin(async (tx) => {
      await tx.unsafe(
        source.replace(/^begin;\s*/, "").replace(/commit;\s*$/, ""),
      );
      await tx`insert into supabase_migrations.schema_migrations(version,statements,name) values(${version},${tx.array([source])},'image_delivery_and_uploads')`;
      await tx`notify pgrst,'reload schema'`;
    });
  }
  const state =
    await db`select relrowsecurity as rls from pg_class where oid='public.media_upload_jobs'::regclass`;
  const grants =
    await db`select grantee,privilege_type from information_schema.role_table_grants where table_name='media_upload_jobs' and table_schema='public'`;
  console.log(
    JSON.stringify({
      applied: true,
      rls: state[0].rls,
      unexpectedClientGrants: grants.filter((r) =>
        ["anon", "authenticated", "PUBLIC"].includes(r.grantee),
      ),
    }),
  );
} finally {
  await db.end();
}
