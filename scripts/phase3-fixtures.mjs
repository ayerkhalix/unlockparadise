import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { totp } from "../tests/helpers/staging-auth.ts";
import { assertStagingFixture } from "./staging-project.mjs";
const file = "artifacts/staging-private/identities.json",
  fixture = JSON.parse(await readFile(file, "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assertStagingFixture(fixture);
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = (r) => {
  if (r.error)
    throw new Error(
      `Synthetic setup failed: ${r.error.code || r.error.status || "unknown"}`,
    );
  return r.data;
};
const save = () =>
  writeFile(file, JSON.stringify(fixture, null, 2), { mode: 0o600 });
for (const role of ["editor", "order_manager"]) {
  if (!fixture.users[role]) {
    const email = `upd-${fixture.project.slice(0, 6)}-${role}@unlock-paradise.invalid`,
      password = randomBytes(32).toString("base64url") + "Aa1!";
    const result = check(
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { synthetic_staging: true, terms_accepted: true },
      }),
    );
    fixture.users[role] = { id: result.user.id, email, password };
    await save();
  }
  const user = fixture.users[role];
  if (!user.email.endsWith("@unlock-paradise.invalid"))
    throw new Error("Only synthetic identities may be changed.");
  check(
    await db
      .from("profiles")
      .update({ display_name: `Staging ${role.replaceAll("_", " ")}` })
      .eq("id", user.id),
  );
  check(await db.from("user_roles").upsert({ user_id: user.id, role }));
  const auth = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  check(
    await auth.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    }),
  );
  if (!user.factor) {
    const enrolled = check(
      await auth.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Synthetic studio acceptance",
      }),
    );
    user.factor = { id: enrolled.id, secret: enrolled.totp.secret };
    await save();
  }
  check(
    await auth.auth.mfa.challengeAndVerify({
      factorId: user.factor.id,
      code: totp(user.factor.secret),
    }),
  );
}
console.log(
  JSON.stringify({
    project: fixture.project,
    studio_test_roles: ["editor", "order_manager"],
    mfa: "verified",
    emails_sent: 0,
    credentials: "Ignored private fixture file only",
  }),
);
