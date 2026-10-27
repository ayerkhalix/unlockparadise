import { z } from "zod";
import { api, json, verifyOrigin } from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
import { finishAdminUpload } from "@/lib/storage/admin-upload";
export const maxDuration = 120;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireStaff(request);
    const { id } = await params;
    z.uuid().parse(id);
    const data = await finishAdminUpload(id, current.user.id);
    return json({ data }, data.state === "ready" ? 200 : 202);
  });
}
