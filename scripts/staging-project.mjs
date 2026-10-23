// Node-only operator/test guard. Never import into application or browser code.
import { readFileSync } from "node:fs";
const original = "iitblbdqztuxdzpaetie",
  client = "namkxlsdjnopixhzrvyl";
export function assertStagingProject(env = process.env, proof) {
  let origin;
  try {
    origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  } catch {
    throw new Error("Pinned staging configuration required");
  }
  const ref = env.MIGRATION_PROJECT_REF || original;
  if (
    env.UPD_ENVIRONMENT !== "staging" ||
    ![original, client].includes(ref) ||
    origin !== `https://${ref}.supabase.co`
  )
    throw new Error("Pinned staging configuration required");
  if (ref === client) {
    const result =
      proof ||
      JSON.parse(
        readFileSync(
          "artifacts/client-migration/final-verification.json",
          "utf8",
        ),
      );
    if (
      result.source !== original ||
      result.target !== client ||
      result.status !== "verified-for-cutover" ||
      !Array.isArray(result.differences) ||
      result.differences.length
    )
      throw new Error("Verified client migration required for staging tools");
  }
  return ref;
}
export function assertStagingFixture(fixture, env = process.env, proof) {
  const ref = assertStagingProject(env, proof);
  if (
    fixture.project !== ref &&
    !(ref === client && fixture.project === original)
  )
    throw new Error("Synthetic fixture belongs to another project");
  return ref;
}
