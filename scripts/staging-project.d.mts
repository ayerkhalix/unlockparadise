type MigrationProof = {
  source: string;
  target: string;
  status: string;
  differences: unknown[];
};
export function assertStagingProject(
  env?: NodeJS.ProcessEnv,
  proof?: MigrationProof,
): string;
export function assertStagingFixture(
  fixture: { project: string },
  env?: NodeJS.ProcessEnv,
  proof?: MigrationProof,
): string;
