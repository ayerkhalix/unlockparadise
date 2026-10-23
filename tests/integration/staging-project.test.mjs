import test from "node:test";
import assert from "node:assert/strict";
import {
  assertStagingProject,
  assertStagingFixture,
} from "../../scripts/staging-project.mjs";
const source = "iitblbdqztuxdzpaetie",
  target = "namkxlsdjnopixhzrvyl";
const environment = (ref) => ({
  UPD_ENVIRONMENT: "staging",
  MIGRATION_PROJECT_REF: ref,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
});
const proof = {
  source,
  target,
  status: "verified-for-cutover",
  differences: [],
};
test("operator tools require a pinned verified migration and staging environment", () => {
  assert.equal(assertStagingProject(environment(source)), source);
  assert.throws(() => assertStagingProject({ ...environment(source), NEXT_PUBLIC_SUPABASE_URL: `http://${source}.supabase.co` }));
  assert.equal(
    assertStagingFixture({ project: source }, environment(target), proof),
    target,
  );
  assert.throws(() =>
    assertStagingProject(environment(target), {
      ...proof,
      status: "differences-found",
    }),
  );
  assert.throws(() =>
    assertStagingProject(environment(target), {
      ...proof,
      differences: ["missing image"],
    }),
  );
  assert.throws(() =>
    assertStagingProject(environment("unapproved-project"), proof),
  );
  assert.throws(() =>
    assertStagingProject(
      { ...environment(target), UPD_ENVIRONMENT: "production" },
      proof,
    ),
  );
  assert.throws(() =>
    assertStagingProject(
      {
        ...environment(target),
        NEXT_PUBLIC_SUPABASE_URL: `https://${source}.supabase.co`,
      },
      proof,
    ),
  );
  assert.throws(() =>
    assertStagingFixture(
      { project: "unapproved-project" },
      environment(target),
      proof,
    ),
  );
});
