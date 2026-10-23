import { backendConfigured } from "@/lib/supabase/config";
export function GET() {
  return Response.json(
    {
      status: "ok",
      backend: backendConfigured() ? "configured" : "unconfigured",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
