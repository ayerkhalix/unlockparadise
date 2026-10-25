import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const cached = new Map<
  string,
  Awaited<ReturnType<BrowserContext["cookies"]>>
>();
export async function signIn(context: BrowserContext, email: string) {
  if (!cached.has(email)) {
    const env = parseEnv(await readFile(".env.local", "utf8"));
    const fixture = JSON.parse(
      await readFile("artifacts/deployment/demo-accounts.json", "utf8"),
    );
    const account = fixture.accounts.find(
      (a: { email: string }) => a.email === email,
    );
    const jar = new Map<string, string>();
    const db = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (values) =>
            values.forEach((item) => jar.set(item.name, item.value)),
        },
      },
    );
    const result = await db.auth.signInWithPassword({
      email,
      password: account.password,
    });
    if (result.error) throw Error("Demo sign-in unavailable");
    cached.set(
      email,
      [...jar].map(([name, value]) => ({
        name,
        value,
        domain: new URL(base).hostname,
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      })),
    );
  }
  await context.addCookies(cached.get(email)!);
}
