import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
function secret() {
  const value = process.env.AUTH_RECOVERY_SECRET;
  if (!value || value.length < 32) throw new Error("BACKEND_UNCONFIGURED");
  return value;
}
export function recoveryGrant(userId: string, now = Date.now()) {
  const payload = `${userId}.${now}`;
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}
export function verifyRecoveryGrant(
  grant: string,
  userId: string,
  now = Date.now(),
) {
  const [id, stamp, signature] = grant.split(".");
  const issued = Number(stamp);
  if (
    id !== userId ||
    !Number.isFinite(issued) ||
    now - issued > 600000 ||
    issued > now ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    return false;
  const expected = createHmac("sha256", secret())
    .update(`${id}.${stamp}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
