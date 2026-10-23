import { createHmac, timingSafeEqual } from "node:crypto";
export const plans = {
  monthly: { months: 1, amount: 5000 },
  quarterly: { months: 3, amount: 13500 },
  yearly: { months: 12, amount: 42000 },
} as const;
export function verifyPaymongoSignature(
  raw: string,
  header: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  if (!secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((x) => x.trim().split("=", 2)),
  );
  if (
    !/^\d+$/.test(parts.t || "") ||
    Math.abs(now - Number(parts.t)) > 300 ||
    !/^[a-f0-9]{64}$/.test(parts.te || "")
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(parts.t + "." + raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(parts.te, "hex"));
}
export function sandboxKey(key: string | undefined) {
  if (!key?.startsWith("sk_test_")) throw new Error("PAYMENTS_UNCONFIGURED");
  return key;
}
export function checkoutUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "paymongo.com" || url.hostname.endsWith(".paymongo.com"))
  )
    throw new Error("INVALID_CHECKOUT_URL");
  return url.href;
}
