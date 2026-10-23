import "server-only";
import { createHash } from "node:crypto";
import { privilegedSupabase } from "@/lib/supabase/server";
import { ApiError, databaseError } from "@/lib/http";
export async function rateLimit(
  scope: string,
  identity: string,
  maximum = 10,
  seconds = 600,
) {
  const key = scope + ":" + createHash("sha256").update(identity).digest("hex");
  const { data, error } = await privilegedSupabase().rpc("consume_rate_limit", {
    rate_key: key,
    max_hits: maximum,
    window_seconds: seconds,
  });
  databaseError(error);
  if (!data) throw new ApiError(429, "Please wait before trying again.");
}
