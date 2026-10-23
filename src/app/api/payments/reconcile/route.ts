import { z } from "zod";
import {
  api,
  ApiError,
  input,
  json,
  verifyOrigin,
  databaseError,
} from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { reconcileXenditSession } from "@/lib/payments/xendit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireSession(request);
    const body = await input(
      request,
      z.object({ transaction_id: z.string().uuid() }).strict(),
    );
    await rateLimit("payment-status", current.user.id, 30, 600);
    const result = await current.db
      .from("payment_transactions")
      .select("id,provider,status,provider_session_id")
      .eq("id", body.transaction_id)
      .eq("user_id", current.user.id)
      .maybeSingle();
    databaseError(result.error);
    if (!result.data || result.data.provider !== "xendit")
      throw new ApiError(404, "Payment not found.");
    if (result.data.status === "paid")
      return json({
        status: "paid",
        message: "Payment confirmed. Your Explorer+ membership is active.",
        redirect_to: "/account/",
      });
    if (!result.data.provider_session_id)
      throw new ApiError(
        409,
        "Checkout is still being prepared. Please wait before checking again.",
      );
    const state = await reconcileXenditSession(result.data.provider_session_id);
    return json({
      status: state.status,
      message:
        state.status === "paid"
          ? "Payment confirmed. Your Explorer+ membership is active."
          : state.status === "expired"
            ? "This checkout has closed. No membership was activated."
            : "Payment is still pending. Complete your Xendit test checkout, then check again.",
      redirect_to: state.status === "paid" ? "/account/" : undefined,
    });
  });
}
