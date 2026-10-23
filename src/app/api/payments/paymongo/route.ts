import { createHash } from "node:crypto";
import { z } from "zod";
import { api, ApiError, databaseError, json, boundedText } from "@/lib/http";
import { verifyPaymongoSignature, sandboxKey } from "@/lib/payments/core";
import { provider } from "@/lib/payments/paymongo";
import { privilegedSupabase } from "@/lib/supabase/server";
const eventSchema = z.object({
  data: z.object({
    id: z.string().min(1).max(200),
    attributes: z.object({
      livemode: z.literal(false),
      type: z.string().max(100),
      data: z.object({ id: z.string().min(1).max(200) }),
    }),
  }),
});
export async function POST(request: Request) {
  return api(async () => {
    try {
      sandboxKey(process.env.PAYMONGO_SECRET_KEY);
    } catch {
      throw new ApiError(503, "Payment sandbox is not configured.");
    }
    if (Number(request.headers.get("content-length") || 0) > 262144)
      throw new ApiError(413, "Event is too large.");
    const raw = await boundedText(request, 262144);
    if (Buffer.byteLength(raw) > 262144)
      throw new ApiError(413, "Event is too large.");
    if (
      !verifyPaymongoSignature(
        raw,
        request.headers.get("paymongo-signature") || "",
        process.env.PAYMONGO_WEBHOOK_SECRET || "",
      )
    )
      throw new ApiError(401, "Invalid event signature.");
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Invalid event.");
    }
    const event = eventSchema.parse(payload).data;
    const type = event.attributes.type;
    const sid = event.attributes.data.id;
    const db = privilegedSupabase();
    const hash = createHash("sha256").update(raw).digest("hex");
    if (type !== "checkout_session.payment.paid") {
      const result = await db.from("payment_events").upsert(
        {
          provider_event_id: event.id,
          event_type: type,
          payload_hash: hash,
          outcome: type.includes("refund")
            ? "refund_requires_reconciliation"
            : "ignored",
        },
        { onConflict: "provider_event_id", ignoreDuplicates: true },
      );
      databaseError(result.error);
      return json({ received: true, handled: false });
    }
    const remote = await provider(
      "GET",
      "checkout_sessions/" + encodeURIComponent(sid),
    );
    const attrs = remote.data?.attributes;
    if (attrs?.livemode === true)
      throw new ApiError(400, "Live payments are disabled.");
    const payments = attrs?.payments;
    const paid = Array.isArray(payments)
      ? payments.find((p) => p.attributes?.status === "paid")
      : undefined;
    if (
      !paid?.id ||
      !Number.isInteger(paid.attributes.amount) ||
      paid.attributes.currency !== "PHP"
    )
      throw new ApiError(409, "Payment is not confirmed by the provider.");
    const applied = await db.rpc("apply_paid_checkout", {
      event_id: event.id,
      session_id: sid,
      payment_id: paid.id,
      amount: paid.attributes.amount,
      currency_code: paid.attributes.currency,
      event_hash: hash,
    });
    databaseError(applied.error);
    return json({ received: true, ...applied.data });
  });
}
