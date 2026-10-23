import { MembershipPlanPicker } from "./membership-plan-picker";
import { Icon } from "./icon";
import { currentSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { databaseError } from "@/lib/http";
import { paymentProvider } from "@/lib/payments/provider";
import { xenditTestUser } from "@/lib/payments/xendit-core";
import { PaymentStatus } from "./payment-status";
import { z } from "zod";
export async function Checkout({
  paymentReturn = false,
  transactionId,
}: {
  paymentReturn?: boolean;
  transactionId?: string;
}) {
  const current = await currentSession();
  const returnId = z.string().uuid().safeParse(transactionId);
  if (!current) {
    if (paymentReturn && returnId.success) {
      const destination = `/checkout/?payment=return&transaction_id=${returnId.data}`;
      redirect(`/login/?redirect_to=${encodeURIComponent(destination)}`);
    }
    redirect("/login/?redirect_to=/checkout/");
  }
  const xendit = paymentProvider() === "xendit";
  const approvedTestAccount = !xendit || xenditTestUser(current.user.id);
  let paymentQuery = current.db
    .from("payment_transactions")
    .select("id,status,provider_session_id")
    .eq("user_id", current.user.id)
    .eq("provider", "xendit");
  if (paymentReturn && returnId.success)
    paymentQuery = paymentQuery.eq("id", returnId.data);
  const recent =
    xendit && (!paymentReturn || returnId.success)
      ? await paymentQuery
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null;
  databaseError(recent?.error || null);
  const plans = await current.db
    .from("membership_plans")
    .select("id,months,amount_centavos,currency")
    .eq("active", true)
    .order("months");
  databaseError(plans.error);
  return (
    <main className="upd-main p3-checkout-page" id="upd-main">
      <div className="upd-container p3-checkout-layout">
        <section className="p3-checkout-intro" aria-labelledby="checkout-title">
          <a className="p2-back" href="/membership/">
            Back to membership
          </a>
          <h1 id="checkout-title">
            Go Explorer<span>+</span>
          </h1>
          <p className="p3-checkout-lead">Choose your membership.</p>
          <p className="p2-muted">
            Get access to Explorer+ destinations, save places and plan your
            route across Palawan.
          </p>
          {recent?.data && (
            <PaymentStatus
              key={`${recent.data.id}:${paymentReturn}`}
              transactionId={recent.data.id}
              initialStatus={recent.data.status}
              canCheck={Boolean(recent.data.provider_session_id)}
              autoCheck={paymentReturn}
            />
          )}
          <ul className="p3-checkout-inclusions">
            <li>
              <Icon name="Location" size={22} />
              <span>
                Access every destination
                <strong>Including Explorer+ hidden gems</strong>
              </span>
            </li>
            <li>
              <Icon name="Directions" size={22} />
              <span>
                Make it your Palawan
                <strong>Your Bucketlist and travel portfolio</strong>
              </span>
            </li>
            <li>
              <Icon name="Clock" size={22} />
              <span>
                Pay once. Explore at your pace.
                <strong>No automatic charges.</strong>
              </span>
            </li>
          </ul>
          <div className="p3-checkout-identity">
            <Icon name="Person" size={22} />
            <div>
              <span>Signed in as</span>
              <strong>{current.user.email}</strong>
              <a href="/account/">View account</a>
            </div>
          </div>
        </section>
        <section className="p3-checkout-panel" aria-label="Membership payment">
          {xendit && (
            <div className="p3-sandbox-notice">
              <Icon name="Lock" size={20} />
              <p>
                This is a Xendit test checkout. No real payment is collected.
              </p>
            </div>
          )}
          {xendit && !approvedTestAccount && (
            <p className="p3-checkout-restriction">
              Payment testing is available to approved test accounts only.
            </p>
          )}
          {paymentReturn && !recent?.data && (
            <p role="status">
              We could not find this payment for your account. Open checkout
              from your membership page to check your latest payment.
            </p>
          )}
          <MembershipPlanPicker
            plans={plans.data || []}
            approved={approvedTestAccount}
          />
          <p className="p3-checkout-support">
            A question before you go? <a href="/contact/">Contact us</a>
          </p>
        </section>
      </div>
    </main>
  );
}
