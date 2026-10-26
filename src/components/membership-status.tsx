import { currentSession } from "@/lib/auth/session";
import { databaseError } from "@/lib/http";

export async function MembershipStatus() {
  const current = await currentSession();
  if (!current?.premium) return null;
  const result = await current.db
    .from("subscriptions")
    .select("status,paid_through,kind")
    .eq("user_id", current.user.id)
    .in("status", ["active", "cancelled"])
    .gt("paid_through", "now")
    .order("created_at", { ascending: false });
  databaseError(result.error);
  const active = result.data?.[0];
  return (
    <main id="upd-main" className="upd-main">
      <div className="p2-shell membership-current">
        <span className="membership-label membership-label--plus">
          Explorer+
        </span>
        <h1>Your membership</h1>
        <p className="membership-current-status">
          Your Explorer+ access is active.
        </p>
        {active?.paid_through && (
          <p>
            Active until{" "}
            {new Date(active.paid_through).toLocaleDateString("en-PH", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Manila",
            })}
            .
          </p>
        )}
        <p className="p2-muted">
          Your destination guides, saved places and trip tools are ready.
        </p>
        <nav
          className="membership-current-links"
          aria-label="Your Explorer+ features"
        >
          <a href="/#palawan-map">
            Explore the map <span aria-hidden="true">↗</span>
          </a>
          <a href="/itineraries/">
            Itinerary Planner <span aria-hidden="true">↗</span>
          </a>
          <a href="/bucketlist/">
            My Bucketlist <span aria-hidden="true">↗</span>
          </a>
          <a href="/portfolio/">
            My Portfolio <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <a className="p2-back" href="/account/">
          Back to your account
        </a>
      </div>
    </main>
  );
}
