import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { BucketlistPage } from "@/components/bucketlist";
import { FeatureLock } from "@/components/feature-lock";
export const metadata = { title: "My Bucketlist" };
export default async function Page() {
  const current = await currentSession();
  if (!current) redirect("/login/?redirect_to=/bucketlist/");
  return (
    <main id="upd-main" className="upd-main">
      <div className="p2-shell">
        {current.premium ? (
          <BucketlistPage />
        ) : (
          <FeatureLock feature="Bucketlist" />
        )}
      </div>
    </main>
  );
}
