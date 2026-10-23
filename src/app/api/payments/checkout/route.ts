import { z } from "zod";
import { api, input, json, verifyOrigin } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { createCheckout } from "@/lib/payments/provider";
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireSession(request);
    const body = await input(
      request,
      z
        .object({
          plan: z.enum(["monthly", "quarterly", "yearly"]),
          idempotency_key: z.string().uuid(),
        })
        .strict(),
    );
    return json(
      await createCheckout(current.user.id, body.plan, body.idempotency_key),
    );
  });
}
