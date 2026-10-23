import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import "./admin.css";
import "./studio-design.css";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await currentSession();
  if (!current) redirect("/login/?redirect_to=/admin/");
  const role = await current.db
    .from("user_roles")
    .select("role")
    .eq("user_id", current.user.id)
    .maybeSingle();
  if (role.error || !role.data) redirect("/account/");
  return children;
}
