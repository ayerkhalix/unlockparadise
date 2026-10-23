import { MfaForm } from "@/components/mfa-form";
import { AdminBrand, AdminThemeToggle } from "@/components/admin-theme";
export const metadata = { title: "Administrator verification" };
export default function MfaPage() {
  return (
    <main className="upd-main upd-admin studio-auth" id="upd-main">
      <header className="studio-auth-header">
        <a href="/admin/">
          <AdminBrand />
        </a>
        <AdminThemeToggle />
      </header>
      <div className="upd-container studio-auth-content">
        <h1>Administrator verification</h1>
        <p>Verify with your authenticator app to manage Unlock Paradise.</p>
        <MfaForm />
      </div>
    </main>
  );
}
