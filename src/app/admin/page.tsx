import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { AdminConsole } from "@/components/admin-console";
export const metadata = { title: "Unlock Paradise Admin" };
export default async function AdminPage() {
  const current = await currentSession();
  if (!current?.staff && !current?.orders) redirect("/admin/mfa/");
  const assurance = await current.db.auth.mfa.getAuthenticatorAssuranceLevel();
  return (
    <main className="upd-main upd-admin" id="upd-main">
      <div className="upd-container">
        <AdminConsole
          administrator={current.admin}
          content={current.staff}
          orders={current.orders}
          mfaVerified={assurance.data?.currentLevel === "aal2"}
        />
      </div>
    </main>
  );
}
