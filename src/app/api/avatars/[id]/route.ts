import { z } from "zod";
import { api } from "@/lib/http";
import { privilegedSupabase } from "@/lib/supabase/server";
import { publicAvatar } from "@/lib/public-avatar";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    z.uuid().parse(id);
    return publicAvatar(request, id, privilegedSupabase());
  });
}
