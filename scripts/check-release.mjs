import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const sources = [
  ...new Set([
    ...files,
    ...execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ]),
];
const forbidden = files.filter(
  (file) =>
    /^(reference|artifacts)\//.test(file) ||
    (/^\.env/.test(file) && file !== ".env.example") ||
    file.endsWith("destinations.private.json"),
);
const findings = [];
for (const file of sources.filter(
  (f) => /\.(ts|tsx|mjs|py|json|sql|md)$/.test(f) && !f.startsWith("public/"),
)) {
  const source = await readFile(file, "utf8");
  if (
    /sb_secret_[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9]{16,}|\$P\$[A-Za-z0-9./]{25,}/.test(
      source,
    )
  )
    findings.push(file);
}
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(directory + "/" + e.name)
          : [directory + "/" + e.name],
      ),
    )
  ).flat();
}
const browserLeaks = [];
for (const file of (await walk(".next/static")).filter((f) =>
  f.endsWith(".js"),
)) {
  const data = await readFile(file, "utf8");
  if (
    data.includes("SUPABASE_SECRET_KEY") ||
    data.includes("AUTH_RECOVERY_SECRET")
  )
    browserLeaks.push(file);
}
const report = {
  tracked_files: files.length,
  forbidden_tracked_paths: forbidden,
  suspected_secrets: findings,
  browser_secret_modules: browserLeaks,
  passed: !forbidden.length && !findings.length && !browserLeaks.length,
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/release-check.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
