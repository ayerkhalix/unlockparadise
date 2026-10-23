import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { backendConfigured } from "@/lib/supabase/config";
import { ApiError } from "@/lib/http";

export async function session(request?: Request) {
  if (!backendConfigured()) return null;
  const db = await serverSupabase(request);
  const bearer = request?.headers.get("authorization")?.slice(7);
  const { data, error } = await db.auth.getUser(bearer);
  if (error || !data.user) return null;
  const access = await db.rpc("viewer_access");
  if (access.error)
    throw new ApiError(503, "Account permissions are temporarily unavailable.");
  return {
    db,
    user: data.user,
    premium: access.data?.premium === true,
    staff: access.data?.staff === true,
    admin: access.data?.admin === true,
    orders: access.data?.orders === true,
  };
}
export const currentSession = cache(() => session());
export async function requireSession(request?: Request) {
  const current = await session(request);
  if (!current) throw new ApiError(401, "Sign in to continue.");
  return current;
}
export async function requireStaff(request?: Request, admin = false) {
  const current = await requireSession(request);
  if (!(admin ? current.admin : current.staff))
    throw new ApiError(
      403,
      "An authorized administrator session with MFA is required.",
    );
  return current;
}
export async function requireOrders(request?: Request) {
  const current = await requireSession(request);
  if (!current.orders)
    throw new ApiError(
      403,
      "An authorized order session with MFA is required.",
    );
  return current;
}

export async function requirePremium(request?: Request) {
  const current = await requireSession(request);
  if (!current.premium) throw new ApiError(403, "Explorer+ is required.");
  return current;
}
