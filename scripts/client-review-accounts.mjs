// Dedicated local/staging client-review identities; never imported by the app.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { assertStagingProject, assertStagingFixture } from "./staging-project.mjs";
const project = assertStagingProject(),
  directory = "artifacts/staging-private",
  file = directory + "/client-accounts.json";
if (
  process.env.UPD_ENVIRONMENT !== "staging" ||
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !==
    project + ".supabase.co"
)
  throw new Error("Pinned staging required.");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const check = (r) => {
  if (r.error)
    throw new Error(
      `Client account setup failed: ${r.error.code || r.error.status || "unknown"}`,
    );
  return r.data;
};
let fixture;
try {
  fixture = JSON.parse(await readFile(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  fixture = { project, users: {} };
}
assertStagingFixture(fixture);
await mkdir(directory, { recursive: true });
const save = () =>
  writeFile(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
for (const role of ["client_admin", "client_explorer_plus"]) {
  let user = fixture.users[role];
  if (!user) {
    const email = `upd-iitblb-${role.replaceAll("_", "-")}@unlock-paradise.invalid`,
      password = randomBytes(18).toString("base64url") + "Aa1!";
    const made = check(
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { synthetic_staging: true },
      }),
    );
    user = fixture.users[role] = { id: made.user.id, email, password };
    await save();
  }
  const existing = check(await db.auth.admin.getUserById(user.id));
  if (
    existing.user.email !== user.email ||
    !user.email.endsWith("@unlock-paradise.invalid")
  )
    throw new Error("Client fixture identity mismatch.");
  check(
    await db
      .from("profiles")
      .update({
        display_name:
          role === "client_admin" ? "Client Admin" : "Client Explorer+",
      })
      .eq("id", user.id),
  );
  if (role === "client_admin") {
    check(
      await db.from("user_roles").upsert({ user_id: user.id, role: "admin" }),
    );
    check(
      await db.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...existing.user.app_metadata,
          staging_client_review: true,
        },
      }),
    );
  } else {
    user.entitlement_id ||= randomUUID();
    await save();
    check(
      await db.from("entitlements").upsert({
        id: user.entitlement_id,
        user_id: user.id,
        source: "manual",
        reason: "Owner-authorized client staging review",
        expires_at: null,
        revoked_at: null,
      }),
    );
  }
}
await save();
console.log(
  JSON.stringify({
    project,
    created: true,
    adminId: fixture.users.client_admin.id,
    explorerPlusId: fixture.users.client_explorer_plus.id,
    credentialsFile: file,
    emailsSent: 0,
  }),
);
