import { currentSession } from "@/lib/auth/session";
import { FeatureLock } from "@/components/feature-lock";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await currentSession();
  return (
    <main className="upd-main" id="upd-main">
      <div className="p2-shell p2-planner-shell">
        {current?.premium ? (
          children
        ) : (
          <FeatureLock feature="Itinerary Planner" />
        )}
      </div>
    </main>
  );
}
