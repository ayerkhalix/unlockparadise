import { currentSession } from "@/lib/auth/session";
import { SavedPlacesPage } from "@/components/bucketlist";
import { FeatureLock } from "@/components/feature-lock";
export const metadata = { title: "My Bucketlist" };
export default async function Page() {
  const current = await currentSession();
  return (
    <main id="upd-main" className="upd-main">
      <div className="p2-shell">
        {current?.premium ? (
          <SavedPlacesPage key="bucketlist" />
        ) : (
          <FeatureLock feature="Bucketlist" />
        )}
      </div>
    </main>
  );
}
