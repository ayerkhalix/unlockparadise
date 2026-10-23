import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import postgres from "postgres";

const pins = { SOURCE: "iitblbdqztuxdzpaetie", TARGET: "namkxlsdjnopixhzrvyl" };
export async function configuration() {
  const env = parseEnv(await readFile(".env.migration.local", "utf8"));
  const sides = {};
  for (const [side, ref] of Object.entries(pins)) {
    let url;
    try {
      url = new URL(env[`MIGRATION_${side}_DB_URL`]);
    } catch {
      throw new Error(`${side}_database_URI_invalid`);
    }
    if (
      env[`MIGRATION_${side}_PROJECT_REF`] !== ref ||
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !(
        url.hostname === `db.${ref}.supabase.co` ||
        (url.hostname.endsWith(".pooler.supabase.com") &&
          decodeURIComponent(url.username) === `postgres.${ref}`)
      ) ||
      !url.password ||
      /YOUR.PASSWORD|\[|\]/i.test(decodeURIComponent(url.password))
    )
      throw new Error(`${side}_database_configuration_invalid`);
    const pgEnv = {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.slice(1) || "postgres",
      PGSSLMODE: "require",
      PGCONNECT_TIMEOUT: "20",
    };
    sides[side] = { ref, url: url.toString(), pgEnv };
  }
  return { env, ...sides };
}
export function connect(side) {
  return postgres(side.url, {
    max: 1,
    ssl: "require",
    connect_timeout: 20,
    onnotice: () => {},
  });
}
export async function pgTool(tool, args, side, logFile) {
  const stdout = [],
    stderr = [];
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      path.resolve(`artifacts/tools/postgresql-17.11/${tool}.exe`),
      args,
      {
        env: side.pgEnv,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", () => reject(new Error(`${tool}_start_failed`)));
    child.once("close", resolve);
  });
  if (logFile)
    await writeFile(logFile, Buffer.concat([...stdout, ...stderr]), {
      flag: "wx",
      mode: 0o600,
    });
  if (code !== 0)
    throw new Error(`${tool}_failed_exit_${code}_see_private_log`);
  return Buffer.concat(stdout);
}
async function backup() {
  const config = await configuration();
  const root = path.resolve(
    "artifacts/client-migration/database",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const report = {
    startedAt: new Date().toISOString(),
    files: [],
    status: "running",
  };
  try {
    // Independent project snapshots; never mutate either database during backup.
    for (const sideName of ["SOURCE", "TARGET"]) {
      const side = config[sideName],
        db = connect(side);
      try {
        const archive = path.join(
          root,
          `${sideName.toLowerCase()}-full.backup`,
        );
        const reuse =
          sideName === "SOURCE" &&
          process.argv
            .find((arg) => arg.startsWith("--reuse-source="))
            ?.slice(15);
        if (reuse) {
          const resolved = path.resolve(reuse);
          if (
            !resolved.startsWith(
              path.resolve("artifacts/client-migration/database") + path.sep,
            )
          )
            throw new Error("Unsafe_backup_reuse_path");
          await copyFile(resolved, archive);
        } else {
          await pgTool(
            "pg_dump",
            ["--format=custom", `--file=${archive}`],
            side,
            `${archive}.log`,
          );
        }
        // Derive every extract from the SAME native dump, without another DB scan.
        await pgTool(
          "pg_restore",
          ["--list", archive],
          side,
          `${archive}.contents.log`,
        );
        const archiveBytes = await readFile(archive);
        report.files.push({
          project: side.ref,
          file: path.basename(archive),
          bytes: archiveBytes.length,
          sha256: createHash("sha256").update(archiveBytes).digest("hex"),
        });
        console.log(
          JSON.stringify({
            event: "backup_saved",
            project: sideName,
            file: path.basename(archive),
            bytes: archiveBytes.length,
          }),
        );
        const jobs = [
          [
            "app-schema.sql",
            [
              "--schema-only",
              "--schema=public",
              "--schema=private",
              "--no-owner",
            ],
          ],
          [
            "app-data.sql",
            [
              "--data-only",
              "--schema=public",
              "--schema=private",
              "--no-owner",
            ],
          ],
          ["auth-data.sql", ["--data-only", "--schema=auth", "--no-owner"]],
        ];
        if (sideName === "SOURCE")
          jobs.push([
            "history.sql",
            ["--schema=supabase_migrations", "--no-owner"],
          ]);
        for (const [suffix, args] of jobs) {
          const name = `${sideName.toLowerCase()}-${suffix}`;
          await pgTool(
            "pg_restore",
            [...args, `--file=${path.join(root, name)}`, archive],
            side,
            path.join(root, `${name}.log`),
          );
          const bytes = await readFile(path.join(root, name));
          if (!bytes.length) throw new Error("Empty_backup_file");
          report.files.push({
            project: side.ref,
            file: name,
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
          console.log(
            JSON.stringify({
              event: "backup_saved",
              project: sideName,
              file: name,
              bytes: bytes.length,
            }),
          );
        }
      } finally {
        await db.end({ timeout: 3 });
      }
    }
    report.status = "backups_complete";
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(
      path.join(root, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        status: report.status,
        directory: root,
        error: report.error,
      }),
    );
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve("scripts/migration/project-database.mjs")
) {
  if (process.argv[2] !== "backup")
    throw new Error("Use: node scripts/migration/project-database.mjs backup");
  await backup();
}
