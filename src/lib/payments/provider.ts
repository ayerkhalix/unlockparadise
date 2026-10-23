import "server-only";
import { ApiError } from "@/lib/http";
import { createCheckout as paymongoCheckout } from "./paymongo";
import { createXenditCheckout } from "./xendit";

export function paymentProvider() {
  const provider = process.env.PAYMENT_PROVIDER || "paymongo";
  if (provider !== "paymongo" && provider !== "xendit")
    throw new ApiError(503, "Payments are not configured.");
  return provider;
}
export function createCheckout(userId: string, plan: string, key: string) {
  return paymentProvider() === "xendit"
    ? createXenditCheckout(userId, plan, key)
    : paymongoCheckout(userId, plan, key);
}
