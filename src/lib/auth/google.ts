import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appOrigin, publicConfig } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/http";

export const googleFlowCookie = "upd-google-flow";
export const googleFlowSeconds = 600;
type GoogleFlow = {
  nonce: string;
  next: string;
  origin: string;
  issued: number;
};

function secret() {
  const value = process.env.AUTH_RECOVERY_SECRET;
  if (!value || value.length < 32) throw new Error("BACKEND_UNCONFIGURED");
  return value;
}
function signature(payload: string) {
  // Domain separation prevents recovery grants being reused as OAuth state.
  return createHmac("sha256", secret())
    .update(`google-oauth:${payload}`)
    .digest();
}
export function googleReturnPath(value: unknown) {
  const path = safeRedirect(value);
  return /^\/(?:auth|api|login|join|forgot-password|reset-password)(?:\/|\?|#|$)/.test(
    path,
  )
    ? "/account/"
    : path;
}
export function authOrigin(request: Request) {
  const canonical = appOrigin();
  const actual = new URL(request.url);
  if (
    process.env.NODE_ENV === "development" &&
    actual.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(actual.hostname)
  )
    return actual.origin;
  return canonical;
}
export function issueGoogleFlow(
  next: unknown,
  origin: string,
  now = Date.now(),
) {
  const flow: GoogleFlow = {
    nonce: randomBytes(24).toString("hex"),
    next: googleReturnPath(next),
    origin,
    issued: now,
  };
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return { flow, cookie: `${payload}.${signature(payload).toString("hex")}` };
}
export function readGoogleFlow(
  cookie: string,
  nonce: string | null,
  origin: string,
  now = Date.now(),
): GoogleFlow | null {
  if (cookie.length > 6000 || !/^[a-f0-9]{48}$/.test(nonce || "")) return null;
  const [payload, mac, extra] = cookie.split(".");
  if (extra !== undefined || !payload || !/^[a-f0-9]{64}$/.test(mac || ""))
    return null;
  if (!timingSafeEqual(signature(payload), Buffer.from(mac, "hex")))
    return null;
  try {
    const flow = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as GoogleFlow;
    if (
      flow.nonce !== nonce ||
      flow.origin !== origin ||
      !Number.isFinite(flow.issued) ||
      flow.issued > now ||
      now - flow.issued > googleFlowSeconds * 1000 ||
      typeof flow.next !== "string" ||
      flow.next.length > 2000 ||
      googleReturnPath(flow.next) !== flow.next
    )
      return null;
    return flow;
  } catch {
    return null;
  }
}
export async function googleProviderEnabled() {
  const { url, key } = publicConfig();
  const result = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!result.ok) throw new Error("AUTH_SETTINGS_UNAVAILABLE");
  const settings = await result.json();
  return settings.external?.google === true;
}
export function googleAuthorizeUrl(value: string) {
  const target = new URL(value);
  const expected = new URL(publicConfig().url);
  if (
    target.origin !== expected.origin ||
    target.pathname !==
      `${expected.pathname.replace(/\/$/, "")}/auth/v1/authorize` ||
    target.searchParams.get("provider") !== "google" ||
    !target.searchParams.get("code_challenge") ||
    target.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256"
  )
    throw new Error("INVALID_OAUTH_DESTINATION");
  return target.href;
}
