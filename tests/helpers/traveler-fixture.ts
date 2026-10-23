// Node/Playwright only. Never import this module into application/client code.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomBytes, randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { assertStagingProject } from "../../scripts/staging-project.mjs";
export function travelerService() {
  assertStagingProject();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function temporaryTraveler(
  context: BrowserContext,
  premium = true,
) {
  const service = travelerService();
  const email = `traveler-${randomUUID()}@example.invalid`,
    password = randomBytes(24).toString("base64url");
  const made = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (made.error || !made.data.user)
    throw new Error("Could not create synthetic traveler.");
  const id = made.data.user.id;
  const cleanup = async () => {
    const removed = await service.from("reviews").delete().eq("user_id", id);
    if (removed.error) throw new Error("Synthetic review cleanup failed.");
    const deleted = await service.auth.admin.deleteUser(id);
    if (deleted.error) throw new Error("Synthetic traveler cleanup failed.");
  };
  try {
    if (premium) {
      const grant = await service.from("entitlements").insert({
        user_id: id,
        source: "manual",
        reason: "Temporary Traveler Discovery browser test",
      });
      if (grant.error) throw new Error("Synthetic entitlement failed.");
    }
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
    const signed = await db.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error("Synthetic traveler sign-in failed.");
    await context.addCookies(
      [...jar].map(([name, value]) => ({
        name,
        value,
        url: process.env.BASE_URL || "http://127.0.0.1:3000",
        sameSite: "Lax" as const,
      })),
    );
    return { id, email, password, db, service, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
