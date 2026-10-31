import "server-only";
import { createHash } from "node:crypto";
import { ApiError, databaseError } from "@/lib/http";
import { privilegedSupabase } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/rate-limit";
import {
  sessionId,
  xenditTestKey,
  xenditCheckoutUrl,
  xenditCentavos,
  xenditSession,
  verifyXenditPayment,
  xenditTestUser,
  xenditReturnUrls,
} from "./xendit-core";

class XenditRequestError extends ApiError {
  constructor(public readonly definitelyRejected: boolean) {
    super(
      503,
      "Xendit could not prepare this payment. Please try again later.",
    );
  }
}
export function requireXenditSandbox() {
  try {
    xenditTestKey();
  } catch {
    throw new ApiError(503, "Payments are not configured.");
  }
  if (
    process.env.UPD_ENVIRONMENT !== "staging" ||
    !process.env.XENDIT_WEBHOOK_TOKEN
  )
    throw new ApiError(503, "Payments are not configured.");
}
export async function xenditRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) {
  requireXenditSandbox();
  if (
    !/^\/(?:sessions(?:\/ps-[a-f0-9]{24})?|v3\/payments\/py-[a-f0-9-]{24,36})$/.test(
      path,
    )
  )
    throw new ApiError(400, "Invalid payment resource.");
  const response = await fetch("https://api.xendit.co" + path, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization:
        "Basic " + Buffer.from(xenditTestKey() + ":").toString("base64"),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(path.startsWith("/v3/") ? { "api-version": "2024-11-11" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let code = "UNKNOWN";
    let fields: string[] = [];
    try {
      const error = await response.json();
      if (
        typeof error.error_code === "string" &&
        /^[A-Z_]{1,80}$/.test(error.error_code)
      )
        code = error.error_code;
      if (Array.isArray(error.errors))
        fields = error.errors
          .map((item: { path?: unknown; field?: unknown }) =>
            String(item.path || item.field || ""),
          )
          .filter((name: string) => /^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(name));
    } catch {
      /* Never log raw provider bodies. */
    }
    console.error(
      JSON.stringify({
        event: "xendit_request_rejected",
        status: response.status,
        code,
        fields,
      }),
    );
    throw new XenditRequestError(
      response.status >= 400 &&
        response.status < 500 &&
        ![408, 409, 429].includes(response.status),
    );
  }
  return response.json();
}
type Transaction = {
  id: string;
  user_id: string;
  plan_id: string;
  provider: string;
  status: string;
  amount_centavos: number;
  duration_months: number;
  provider_session_id: string | null;
  provider_business_id: string | null;
  checkout_url: string | null;
};
export async function reconcileXenditSession(
  sid: string,
  expected?: { reference: string; business: string },
) {
  sessionId.parse(sid);
  const remote = xenditSession.parse(
    await xenditRequest("GET", "/sessions/" + sid),
  );
  if (
    remote.payment_session_id !== sid ||
    (expected &&
      (remote.reference_id !== expected.reference ||
        remote.business_id !== expected.business))
  )
    throw new ApiError(409, "The payment session could not be matched.");
  const db = privilegedSupabase();
  const result = await db
    .from("payment_transactions")
    .select("*")
    .eq("id", remote.reference_id)
    .eq("provider", "xendit")
    .maybeSingle();
  databaseError(result.error);
  if (!result.data) return { matched: false, status: remote.status };
  const tx = result.data as Transaction;
  if (
    (tx.provider_session_id && tx.provider_session_id !== sid) ||
    (tx.provider_business_id &&
      tx.provider_business_id !== remote.business_id) ||
    xenditCentavos(remote.amount) !== tx.amount_centavos
  )
    throw new ApiError(409, "The payment session could not be matched.");
  // A webhook may arrive before the create-session response is persisted.
  if (!tx.provider_session_id) {
    if (!remote.payment_link_url)
      throw new ApiError(409, "The payment link is unavailable.");
    const attached = await db.rpc("attach_xendit_membership_session", {
      transaction_id: tx.id,
      session_id: sid,
      checkout_link: xenditCheckoutUrl(remote.payment_link_url),
      business_id: remote.business_id,
      expiry: remote.expires_at || null,
    });
    databaseError(attached.error);
  }
  if (remote.status === "ACTIVE")
    return { matched: true, status: "pending", transaction_id: tx.id };
  let paymentId = "";
  if (remote.status === "COMPLETED") {
    if (!remote.payment_id)
      throw new ApiError(409, "The payment has not been captured.");
    const payment = verifyXenditPayment(
      remote,
      await xenditRequest("GET", "/v3/payments/" + remote.payment_id),
      tx.amount_centavos,
    );
    paymentId = payment.payment_id;
  }
  const evidence = JSON.stringify({
    session: sid,
    reference: remote.reference_id,
    business: remote.business_id,
    status: remote.status,
    payment: paymentId,
    amount: tx.amount_centavos,
  });
  const applied = await db.rpc("apply_xendit_membership_event", {
    // Session webhooks do not carry an event ID. A stable provider/session/state
    // identity deduplicates delivery retries and authenticated reconciliation.
    event_id: `xendit:${sid}:${remote.status}`,
    session_id: sid,
    payment_id: paymentId,
    amount: tx.amount_centavos,
    currency_code: "PHP",
    event_hash: createHash("sha256").update(evidence).digest("hex"),
    session_state: remote.status,
  });
  databaseError(applied.error);
  return {
    matched: true,
    transaction_id: tx.id,
    status:
      tx.status === "paid" || remote.status === "COMPLETED"
        ? "paid"
        : "expired",
    duplicate: applied.data?.duplicate === true,
  };
}
export async function createXenditCheckout(
  userId: string,
  planId: string,
  requestKey: string,
) {
  requireXenditSandbox();
  if (!xenditTestUser(userId))
    throw new ApiError(403, "Checkout is not available for this account yet.");
  await rateLimit("xendit-checkout", userId, 10, 3600);
  const db = privilegedSupabase();
  const reserve = async () => {
    const result = await db.rpc("prepare_xendit_membership_checkout", {
      customer: userId,
      plan_key: planId,
      request_key: requestKey,
    });
    if (result.error?.code === "PT409")
      throw new ApiError(
        409,
        "Finish any existing checkout first. Staff and accounts with permanent access do not need a paid membership.",
      );
    databaseError(result.error);
    return result.data as { created: boolean; transaction: Transaction };
  };
  let prepared = await reserve();
  if (!prepared.created) {
    const tx = prepared.transaction;
    if (tx.status === "paid")
      throw new ApiError(
        409,
        "This payment is already confirmed. View your account.",
      );
    if (!tx.provider_session_id || tx.status === "creating")
      throw new ApiError(
        409,
        "This checkout is still being checked. Please wait before trying again.",
      );
    const state = await reconcileXenditSession(tx.provider_session_id);
    if (state.status === "paid")
      throw new ApiError(409, "Your payment is confirmed. View your account.");
    if (state.status === "pending" && tx.checkout_url)
      return {
        checkout_url: xenditCheckoutUrl(tx.checkout_url),
        transaction_id: tx.id,
      };
    prepared = await reserve();
    if (!prepared.created)
      throw new ApiError(
        409,
        "The previous checkout has closed. Start a new checkout.",
      );
  }
  const tx = prepared.transaction;
  const origin = appOrigin();
  let remote;
  try {
    remote = xenditSession.parse(
      await xenditRequest("POST", "/sessions", {
        reference_id: tx.id,
        session_type: "PAY",
        mode: "PAYMENT_LINK",
        currency: "PHP",
        country: "PH",
        amount: tx.amount_centavos / 100,
        capture_method: "AUTOMATIC",
        allow_save_payment_method: "DISABLED",
        locale: "en",
        customer: {
          reference_id: "UPD" + tx.id.replaceAll("-", ""),
          type: "INDIVIDUAL",
          individual_detail: { given_names: "Explorer" },
        },
        description: `Unlock Paradise Explorer+ for ${tx.duration_months} month${tx.duration_months === 1 ? "" : "s"}`,
        items: [
          {
            reference_id: tx.plan_id,
            type: "DIGITAL_SERVICE",
            category: "Membership",
            name: `Explorer+ ${tx.duration_months} month membership`,
            net_unit_amount: tx.amount_centavos / 100,
            quantity: 1,
          },
        ],
        ...xenditReturnUrls(origin, tx.id),
      }),
    );
  } catch (error) {
    // Definitive provider rejection is safe to retry. Ambiguous network/5xx
    // results retain 'creating'; never blindly POST another payment session.
    if (error instanceof XenditRequestError && error.definitelyRejected) {
      const updated = await db
        .from("payment_transactions")
        .update({ status: "failed" })
        .eq("id", tx.id)
        .eq("status", "creating")
        .is("provider_session_id", null);
      databaseError(updated.error);
    }
    throw error;
  }
  if (
    remote.reference_id !== tx.id ||
    xenditCentavos(remote.amount) !== tx.amount_centavos ||
    !remote.payment_link_url ||
    !remote.expires_at ||
    remote.status !== "ACTIVE"
  )
    throw new ApiError(
      503,
      "The checkout response needs verification before retrying.",
    );
  const checkout = xenditCheckoutUrl(remote.payment_link_url);
  const attached = await db.rpc("attach_xendit_membership_session", {
    transaction_id: tx.id,
    session_id: remote.payment_session_id,
    checkout_link: checkout,
    business_id: remote.business_id,
    expiry: remote.expires_at,
  });
  databaseError(attached.error);
  return { checkout_url: checkout, transaction_id: tx.id };
}
