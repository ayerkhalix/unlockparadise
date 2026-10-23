import { z } from "zod";
import { api, ApiError, boundedText, json } from "@/lib/http";
import { sessionId, verifyXenditToken } from "@/lib/payments/xendit-core";
import {
  reconcileXenditSession,
  requireXenditSandbox,
} from "@/lib/payments/xendit";

export async function POST(request: Request) {
  return api(async () => {
    requireXenditSandbox();
    if (
      !verifyXenditToken(
        request.headers.get("x-callback-token") || "",
        process.env.XENDIT_WEBHOOK_TOKEN || "",
      )
    )
      throw new ApiError(401, "Invalid webhook token.");
    const raw = await boundedText(request, 262144);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Invalid event.");
    }
    const envelope = z.object({ event: z.string().max(100) }).parse(body);
    if (
      !["payment_session.completed", "payment_session.expired"].includes(
        envelope.event,
      )
    )
      return json({ received: true, handled: false });
    const event = z
      .object({
        business_id: z.string().min(1).max(100),
        data: z.object({
          payment_session_id: sessionId,
          reference_id: z.string().max(64),
          business_id: z.string().optional(),
        }),
      })
      .parse(body);
    // Other applications may share this Xendit account and callback settings.
    if (!z.string().uuid().safeParse(event.data.reference_id).success)
      return json({ received: true, handled: false });
    if (event.data.business_id && event.data.business_id !== event.business_id)
      throw new ApiError(409, "The webhook business could not be matched.");
    const result = await reconcileXenditSession(event.data.payment_session_id, {
      reference: event.data.reference_id,
      business: event.business_id,
    });
    return json({ received: true, handled: result.matched, ...result });
  });
}
