import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function xenditTestKey(key = process.env.XENDIT_SECRET_KEY) {
  if (!key?.startsWith("xnd_development_"))
    throw new Error("XENDIT_TEST_UNCONFIGURED");
  return key;
}
export function xenditCheckoutUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["checkout-staging.xendit.co", "dev.xen.to"].includes(url.hostname)
  )
    throw new Error("INVALID_XENDIT_TEST_CHECKOUT");
  return url.href;
}
export function xenditReturnUrls(origin: string, transactionId: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:") return {};
  const transaction = z.string().uuid().parse(transactionId);
  return {
    success_return_url: `${url.origin}/checkout/?payment=return&transaction_id=${transaction}`,
    cancel_return_url: `${url.origin}/checkout/?payment=cancelled`,
  };
}
export function verifyXenditToken(provided: string, expected: string) {
  if (!provided || !expected || provided.length > 1024) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
// Xendit uses pesos; the application and database use integer centavos.
export function xenditCentavos(value: number) {
  const text = String(value);
  if (!Number.isFinite(value) || !/^\d{1,8}(\.\d{1,2})?$/.test(text))
    throw new Error("INVALID_PAYMENT_AMOUNT");
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647)
    throw new Error("INVALID_PAYMENT_AMOUNT");
  return amount;
}
export const sessionId = z.string().regex(/^ps-[a-f0-9]{24}$/);
export const xenditSession = z.object({
  payment_session_id: sessionId,
  reference_id: z.string().uuid(),
  business_id: z.string().min(1).max(100),
  session_type: z.literal("PAY"),
  mode: z.literal("PAYMENT_LINK"),
  country: z.literal("PH"),
  currency: z.literal("PHP"),
  amount: z.number().positive(),
  status: z.enum(["ACTIVE", "COMPLETED", "EXPIRED", "CANCELED"]),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  payment_link_url: z.string().nullable().optional(),
  payment_id: z
    .string()
    .regex(/^py-[a-f0-9-]{24,36}$/)
    .nullable()
    .optional(),
  payment_request_id: z.string().nullable().optional(),
  latest_payment_request_id: z.string().nullable().optional(),
});
export type XenditSession = z.infer<typeof xenditSession>;
export function verifyXenditPayment(
  session: XenditSession,
  value: unknown,
  expectedCentavos: number,
) {
  const payment = z
    .object({
      payment_id: z.string(),
      business_id: z.string(),
      payment_request_id: z.string(),
      type: z.literal("PAY"),
      status: z.literal("SUCCEEDED"),
      currency: z.literal("PHP"),
      country: z.literal("PH"),
      request_amount: z.number().positive(),
      captures: z
        .array(
          z.object({
            capture_id: z.string().min(1),
            capture_amount: z.number().positive(),
          }),
        )
        .min(1),
    })
    .parse(value);
  const captured = payment.captures.reduce(
    (sum, c) => sum + xenditCentavos(c.capture_amount),
    0,
  );
  if (
    session.status !== "COMPLETED" ||
    !session.payment_id ||
    payment.payment_id !== session.payment_id ||
    payment.business_id !== session.business_id ||
    !(session.payment_request_id || session.latest_payment_request_id) ||
    payment.payment_request_id !==
      (session.payment_request_id || session.latest_payment_request_id) ||
    xenditCentavos(session.amount) !== expectedCentavos ||
    xenditCentavos(payment.request_amount) !== expectedCentavos ||
    captured !== expectedCentavos ||
    new Set(payment.captures.map((c) => c.capture_id)).size !==
      payment.captures.length
  )
    throw new Error("PAYMENT_RECONCILIATION_MISMATCH");
  return payment;
}
export function xenditTestUser(userId: string) {
  return (process.env.XENDIT_TEST_USER_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .includes(userId);
}
