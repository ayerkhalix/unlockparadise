// Changes local configuration only after complete verification. Stop the local
// main server before running this; restart it afterwards to reload public keys.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { configuration } from "./project-database.mjs";
const { SOURCE, TARGET, env } = await configuration();
const verified = JSON.parse(
  await readFile("artifacts/client-migration/final-verification.json", "utf8"),
);
if (
  verified.status !== "verified-for-cutover" ||
  verified.target !== TARGET.ref ||
  verified.source !== SOURCE.ref ||
  verified.differences.length ||
  Date.now() - Date.parse(verified.at) > 5 * 60 * 1000
)
  throw new Error(
    "Fresh complete migration verification required before cutover",
  );
const original = await readFile(".env.local", "utf8"),
  current = parseEnv(original);
if (current.NEXT_PUBLIC_SUPABASE_URL !== `https://${SOURCE.ref}.supabase.co`)
  throw new Error(
    "Active app configuration no longer matches source; no changes made",
  );
if (
  current.UPD_ENVIRONMENT !== "staging" ||
  current.UPD_DATA_MODE !== "supabase"
)
  throw new Error(
    "Expected local staging configuration; no production switch supported",
  );
const databaseUrl = new URL(TARGET.url);
databaseUrl.password = encodeURIComponent(
  decodeURIComponent(databaseUrl.password),
);
const replacements = {
  NEXT_PUBLIC_SUPABASE_URL: env.MIGRATION_TARGET_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.MIGRATION_TARGET_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: env.MIGRATION_TARGET_SECRET_KEY,
  SUPABASE_DB_URL: databaseUrl.toString(),
  MIGRATION_PROJECT_REF: TARGET.ref,
  LEGACY_PRIVATE_MEDIA_MODE: "unavailable",
};
let updated = original;
for (const [key, value] of Object.entries(replacements)) {
  if (!value || /[\r\n]/.test(value) || value.includes("$"))
    throw new Error("Missing or unsafe migration configuration value");
  const expression = new RegExp(`^${key}\\s*=.*$`, "m");
  const line = `${key}=${JSON.stringify(value)}`;
  updated = expression.test(updated)
    ? updated.replace(expression, () => line)
    : `${updated.trimEnd()}\n${line}\n`;
}
const parsed = parseEnv(updated);
if (
  parsed.NEXT_PUBLIC_SUPABASE_URL !== `https://${TARGET.ref}.supabase.co` ||
  parsed.XENDIT_SECRET_KEY !== current.XENDIT_SECRET_KEY ||
  parsed.PAYMENT_PROVIDER !== current.PAYMENT_PROVIDER ||
  parsed.XENDIT_TEST_USER_IDS !== current.XENDIT_TEST_USER_IDS
)
  throw new Error("Configuration integrity check failed; no changes made");
const root = path.resolve(
  "artifacts/client-migration/cutover",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(root, { recursive: true, mode: 0o700 });
await writeFile(path.join(root, "source-env.local"), original, {
  flag: "wx",
  mode: 0o600,
});
await writeFile(path.join(root, "client-env.local"), updated, {
  flag: "wx",
  mode: 0o600,
});
const report = {
  at: new Date().toISOString(),
  source: SOURCE.ref,
  target: TARGET.ref,
  sourceEnvironmentSha256: createHash("sha256").update(original).digest("hex"),
  clientEnvironmentSha256: createHash("sha256").update(updated).digest("hex"),
  changedKeys: Object.keys(replacements),
  paymentsPreserved: true,
  status: "prepared",
};
if (process.argv.includes("--apply")) {
  await writeFile(".env.local.migration-next", updated, {
    flag: "wx",
    mode: 0o600,
  });
  await rename(".env.local.migration-next", ".env.local");
  report.status = "local-app-switched";
}
await writeFile(
  path.join(root, "report.json"),
  JSON.stringify(report, null, 2),
  { flag: "wx", mode: 0o600 },
);
console.log(
  JSON.stringify({
    status: report.status,
    project: TARGET.ref,
    rollbackDirectory: root,
    paymentsPreserved: true,
  }),
);
