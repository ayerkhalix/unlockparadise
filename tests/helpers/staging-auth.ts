import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { assertStagingFixture } from "../../scripts/staging-project.mjs";
import type { BrowserContext } from "@playwright/test";
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(
      (bits.match(/.{8}/g) || []).map((b) => parseInt(b, 2)),
    ),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1e6)
    .toString()
    .padStart(6, "0");
}
export async function stagingIdentity(
  context: BrowserContext,
  role: string,
  mfa = true,
) {
  const fixture = JSON.parse(
    await readFile("artifacts/staging-private/identities.json", "utf8"),
  );
  assertStagingFixture(fixture);
  const user = fixture.users[role];
  if (!user) throw new Error("Synthetic identity is missing.");
  const jar = new Map<string, string>();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach((c) => jar.set(c.name, c.value)),
      },
    },
  );
  const signed = await db.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signed.error) throw new Error("Synthetic sign-in failed.");
  if (mfa && user.factor) {
    const verified = await db.auth.mfa.challengeAndVerify({
      factorId: user.factor.id,
      code: totp(user.factor.secret),
    });
    if (verified.error) throw new Error("Synthetic MFA failed.");
  }
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      url: process.env.BASE_URL || "http://127.0.0.1:3000",
      sameSite: "Lax" as const,
    })),
  );
  return { id: user.id, db };
}
