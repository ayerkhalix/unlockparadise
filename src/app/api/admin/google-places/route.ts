import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { api, input, json, verifyOrigin } from "@/lib/http";
import { googlePlacesConfigured, lookupGoogleMaps } from "@/lib/google-places";
import { googleMapsUrl } from "@/lib/nearby-places";
import { rateLimit } from "@/lib/rate-limit";
export async function GET(request: Request) {
  return api(async () => {
    await requireStaff(request);
    return json({ configured: googlePlacesConfigured() });
  });
}
export async function POST(request: Request) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireStaff(request);
    await rateLimit("google-place-lookup", current.user.id, 20, 600);
    const body = await input(
      request,
      z
        .object({
          url: z
            .string()
            .max(2048)
            .refine(
              (v) => !!googleMapsUrl(v),
              "Paste an HTTPS Google Maps place link.",
            ),
        })
        .strict(),
    );
    return json({ data: await lookupGoogleMaps(body.url) });
  });
}
