import { api, json } from "@/lib/http";
import { catalog } from "@/lib/repositories/commerce";
export async function GET() {
  return api(async () => json({ data: await catalog() }));
}
