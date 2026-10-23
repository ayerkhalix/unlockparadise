import "server-only";
import { sandboxKey, checkoutUrl } from "./core";
import { ApiError, databaseError } from "@/lib/http";
import { privilegedSupabase } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/rate-limit";
export async function provider(
  method: string,
  path: string,
  attributes?: unknown,
) {
  let key;
  try {
    key = sandboxKey(process.env.PAYMONGO_SECRET_KEY);
  } catch {
    throw new ApiError(503, "Payment sandbox is not configured.");
  }
  const response = await fetch("https://api.paymongo.com/v1/" + path, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: attributes ? JSON.stringify({ data: { attributes } }) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new ApiError(
      503,
      "The payment provider could not complete this request.",
    );
  return response.json();
}
export async function createCheckout(
  userId: string,
  planId: string,
  idempotencyKey: string,
) {
  if (!process.env.PAYMONGO_WEBHOOK_SECRET)
    throw new ApiError(503, "Payment sandbox is not configured.");
  sandboxKey(process.env.PAYMONGO_SECRET_KEY);
  if (
    !(process.env.PAYMONGO_TEST_USER_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .includes(userId)
  )
    throw new ApiError(
      403,
      "Sandbox checkout is restricted to approved test accounts.",
    );
  await rateLimit("checkout", userId, 10, 3600);
  const db = privilegedSupabase();
  const access = await db
    .from("entitlements")
    .select("source,expires_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .is("expires_at", null);
  databaseError(access.error);
  const roles = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  databaseError(roles.error);
  if (access.data?.length || roles.data?.length)
    throw new ApiError(409, "This account does not need a paid membership.");
  const running = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "subscription")
    .in("status", ["active", "past_due"]);
  databaseError(running.error);
  if (running.data?.length)
    throw new ApiError(
      409,
      "An existing subscription must be reconciled first.",
    );
  const pending = await db
    .from("payment_transactions")
    .select("id,status,checkout_url,plan_id")
    .eq("user_id", userId)
    .in("status", ["creating", "pending"])
    .maybeSingle();
  databaseError(pending.error);
  if (pending.data?.checkout_url && pending.data.plan_id === planId)
    return { checkout_url: checkoutUrl(pending.data.checkout_url) };
  if (pending.data)
    throw new ApiError(
      409,
      "A checkout is already being prepared. Finish or reconcile it before opening another.",
    );
  const plan = await db
    .from("membership_plans")
    .select("*")
    .eq("id", planId)
    .eq("active", true)
    .single();
  databaseError(plan.error);
  if (!plan.data) throw new ApiError(400, "Plan unavailable.");
  const row = await db
    .from("payment_transactions")
    .insert({
      user_id: userId,
      plan_id: planId,
      amount_centavos: plan.data.amount_centavos,
      idempotency_key: idempotencyKey,
      status: "creating",
      livemode: false,
    })
    .select("id")
    .single();
  databaseError(row.error);
  const reference = row.data!.id;
  // A timeout leaves 'creating' for reconciliation: never automatically repeat an ambiguous provider POST.
  const checkout = await provider("POST", "checkout_sessions", {
    line_items: [
      {
        name: `Explorer+ for ${plan.data.months} month${plan.data.months === 1 ? "" : "s"}`,
        description: "Unlock Paradise membership",
        amount: plan.data.amount_centavos,
        currency: "PHP",
        quantity: 1,
      },
    ],
    payment_method_types: (process.env.PAYMONGO_TEST_METHODS || "qrph").split(
      ",",
    ),
    success_url: appOrigin() + "/checkout/?payment=return",
    cancel_url: appOrigin() + "/checkout/?payment=cancelled",
    reference_number: reference,
    description: "Unlock Paradise Explorer+ sandbox",
    send_email_receipt: false,
    show_line_items: true,
    metadata: { transaction_id: reference, kind: "once" },
  });
  const sid = checkout.data?.id,
    url = checkout.data?.attributes?.checkout_url;
  if (typeof sid !== "string" || typeof url !== "string")
    throw new ApiError(
      503,
      "Payment provider returned an incomplete checkout.",
    );
  const safe = checkoutUrl(url);
  const updated = await db
    .from("payment_transactions")
    .update({ provider_session_id: sid, checkout_url: safe, status: "pending" })
    .eq("id", reference);
  databaseError(updated.error);
  return { checkout_url: safe };
}
