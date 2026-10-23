import { readFile, writeFile } from "node:fs/promises";
import { configuration, connect } from "./project-database.mjs";
const config = await configuration(),
  source = connect(config.SOURCE),
  target = connect(config.TARGET);
const partial = process.argv.includes("--allow-partial-media");
const ident = (x) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(x)) throw new Error("Unsafe identifier");
  return `"${x}"`;
};
const hashQuery = (schema, table, expression = "to_jsonb(r)") =>
  `select '${schema}' schema_name,'${table}' table_name,count(*)::int rows,encode(extensions.digest(coalesce(string_agg(h,'' order by h),''),'sha256'),'hex') hash from (select encode(extensions.digest((${expression})::text,'sha256'),'hex') h from ${ident(schema)}.${ident(table)} r) hashed_rows`;
const report = {
  source: config.SOURCE.ref,
  target: config.TARGET.ref,
  at: new Date().toISOString(),
  partialMediaAllowed: partial,
  differences: [],
  tables: [],
};
try {
  await source`set timezone='UTC'`;
  await target`set timezone='UTC'`;
  const tables =
    await source`select table_schema,table_name from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE' order by 1,2`;
  const targetTables =
    await target`select table_schema,table_name from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE' order by 1,2`;
  if (JSON.stringify(tables) !== JSON.stringify(targetTables))
    report.differences.push({ kind: "table inventory" });
  const skip = new Set(["private.rate_limits", "public.audit_logs"]);
  for (const { table_schema: s, table_name: t } of tables) {
    if (skip.has(`${s}.${t}`)) continue;
    let expected = "to_jsonb(r)",
      actual = "to_jsonb(r)";
    if (t === "media" || t === "media_files") {
      const id = t === "media" ? "r.id" : "r.media_id";
      expected = `to_jsonb(r)||jsonb_build_object('bucket',case when r.bucket='destination-public' and exists(select 1 from public.place_media pm join public.places p on p.id=pm.place_id where pm.media_id=${id} and p.vip_content) then 'destination-private' else r.bucket end)`;
      if (partial) {
        expected = `(${expected})-'status'`;
        actual = "to_jsonb(r)-'status'";
      } else expected = `(${expected})||jsonb_build_object('status','ready')`;
    }
    const [a] = await source.unsafe(hashQuery(s, t, expected)),
      [b] = await target.unsafe(hashQuery(s, t, actual));
    report.tables.push({
      table: `${s}.${t}`,
      sourceRows: a.rows,
      targetRows: b.rows,
      match: a.hash === b.hash && a.rows === b.rows,
    });
    if (a.hash !== b.hash || a.rows !== b.rows)
      report.differences.push({
        kind: "table content",
        table: `${s}.${t}`,
        sourceRows: a.rows,
        targetRows: b.rows,
      });
  }
  for (const [table, expression] of [
    ["users", "to_jsonb(r)-array['updated_at','last_sign_in_at']"],
    ["identities", "to_jsonb(r)-array['updated_at','last_sign_in_at']"],
    ["mfa_factors", "to_jsonb(r)-array['updated_at','last_challenged_at']"],
  ]) {
    const [a] = await source.unsafe(hashQuery("auth", table, expression)),
      [b] = await target.unsafe(hashQuery("auth", table, expression));
    report.tables.push({
      table: `auth.${table}`,
      sourceRows: a.rows,
      targetRows: b.rows,
      match: a.hash === b.hash && a.rows === b.rows,
    });
    if (a.hash !== b.hash || a.rows !== b.rows)
      report.differences.push({ kind: "identity content", table });
  }
  // Migration-generated audit entries may be additional, but every source entry
  // must still be present with identical content and its original ID.
  const auditSql =
    "select id::text id,encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex') hash from public.audit_logs r";
  const oldAudit = await source.unsafe(auditSql),
    newAudit = new Map(
      (await target.unsafe(auditSql)).map((r) => [r.id, r.hash]),
    );
  const missingAudit = oldAudit.filter((r) => newAudit.get(r.id) !== r.hash);
  report.audit = {
    source: oldAudit.length,
    target: newAudit.size,
    missingOrChanged: missingAudit.length,
  };
  if (missingAudit.length)
    report.differences.push({
      kind: "source audit entries",
      count: missingAudit.length,
    });
  const historySource =
    await source`select version,statements,name from supabase_migrations.schema_migrations order by version`;
  const historyTarget =
    await target`select version,statements,name from supabase_migrations.schema_migrations order by version`;
  const historyMap = new Map(
    historyTarget.map((r) => [r.version, JSON.stringify(r)]),
  );
  if (
    historySource.some((r) => historyMap.get(r.version) !== JSON.stringify(r))
  )
    report.differences.push({ kind: "original migration history" });
  report.migrations = {
    source: historySource.length,
    target: historyTarget.length,
  };
  const [counts] =
    await target`select (select count(*)::int from public.media where status<>'ready') media_not_ready,(select count(*)::int from public.media_files where status<>'ready') variants_not_ready,(select count(*)::int from storage.objects) storage_objects,(select coalesce(sum((metadata->>'size')::bigint),0)::text from storage.objects) storage_bytes`;
  report.media = counts;
  if (!partial) {
    const progress = JSON.parse(
      await readFile("artifacts/client-migration/media/progress.json", "utf8"),
    );
    if (
      progress.target !== config.TARGET.ref ||
      progress.status !== "all-media-verified" ||
      progress.failed.length
    )
      report.differences.push({ kind: "media checkpoint incomplete" });
    const plan = JSON.parse(
      await readFile("artifacts/client-migration/media/plan.json", "utf8"),
    );
    const objects =
      await target`select bucket_id,name,metadata from storage.objects`;
    const lookup = new Map(objects.map((o) => [`${o.bucket_id}/${o.name}`, o]));
    const keys = new Set();
    let failures = 0;
    for (const object of plan.objects) {
      const key = `${object.bucket}/${object.object_path}`,
        stored = lookup.get(key),
        verified = progress.objects[`${object.table}/${object.id}`];
      keys.add(key);
      if (
        !stored ||
        Number(stored.metadata?.size) !== Number(object.byte_size) ||
        verified?.key !== key ||
        verified?.sha256 !== object.checksum
      )
        failures++;
    }
    report.storage = {
      plannedEntries: plan.objects.length,
      uniqueKeys: keys.size,
      actualObjects: objects.length,
      mismatches: failures,
    };
    if (
      failures ||
      keys.size !== objects.length ||
      counts.media_not_ready ||
      counts.variants_not_ready
    )
      report.differences.push({
        kind: "storage inventory",
        mismatches: failures,
      });
  }
  const foreignKeys =
    await target`select con.conname,n.nspname schema_name,c.relname table_name,rn.nspname ref_schema,rc.relname ref_table,array_agg(a.attname order by k.ord) columns,array_agg(ra.attname order by k.ord) ref_columns from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=con.confrelid join pg_namespace rn on rn.oid=rc.relnamespace cross join lateral unnest(con.conkey,con.confkey) with ordinality k(attnum,refnum,ord) join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum join pg_attribute ra on ra.attrelid=rc.oid and ra.attnum=k.refnum where con.contype='f' and n.nspname in ('public','private') group by con.oid,n.nspname,c.relname,rn.nspname,rc.relname`;
  const invalid = [];
  for (const fk of foreignKeys) {
    const query = `select count(*)::int n from ${ident(fk.schema_name)}.${ident(fk.table_name)} t where ${fk.columns.map((c) => `t.${ident(c)} is not null`).join(" and ")} and not exists(select 1 from ${ident(fk.ref_schema)}.${ident(fk.ref_table)} r where ${fk.columns.map((c, i) => `r.${ident(fk.ref_columns[i])}=t.${ident(c)}`).join(" and ")})`;
    const [result] = await target.unsafe(query);
    if (result.n) invalid.push({ constraint: fk.conname, count: result.n });
  }
  report.relationships = { checked: foreignKeys.length, invalid };
  if (invalid.length)
    report.differences.push({ kind: "foreign key relationships", invalid });
  report.status = report.differences.length
    ? "differences-found"
    : partial
      ? "data-verified-media-in-progress"
      : "verified-for-cutover";
  await writeFile(
    `artifacts/client-migration/${partial ? "interim" : "final"}-verification.json`,
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: report.status,
      tables: report.tables.length,
      relationships: foreignKeys.length,
      differences: report.differences,
      media: counts,
      storage: report.storage,
    }),
  );
  if (report.differences.length) process.exitCode = 1;
} finally {
  await source.end({ timeout: 3 });
  await target.end({ timeout: 3 });
}
