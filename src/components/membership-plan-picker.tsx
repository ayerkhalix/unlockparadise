"use client";
import { membershipSavings } from "@/lib/membership-savings";
import { useState } from "react";
import { ValidatedForm } from "./ui/validated-form";
type Plan = {
  id: string;
  months: number;
  amount_centavos: number;
  currency: string;
};
const money = (amount: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount / 100);
export function MembershipPlanPicker({
  plans,
  approved,
}: {
  plans: Plan[];
  approved: boolean;
}) {
  const [selected, setSelected] = useState(plans[0]?.id || "");
  const monthly = plans.find((p) => p.months === 1);
  const plan = plans.find((p) => p.id === selected);
  return (
    <ValidatedForm
      className="p3-membership-form"
      action="/api/payments/checkout/"
      method="post"
      data-endpoint="/api/payments/checkout/"
    >
      <fieldset className="p3-membership-plans">
        <legend>Choose your membership</legend>
        <p className="p2-muted">One payment for the time you choose.</p>
        {plans.map((p) => (
          <label
            key={p.id}
            className={`p3-membership-plan${p.id === selected ? " is-selected" : ""}`}
          >
            <input
              type="radio"
              name="plan"
              value={p.id}
              checked={p.id === selected}
              onChange={() => setSelected(p.id)}
            />
            <span>
              <strong>
                {p.months === 12
                  ? "One year"
                  : p.months === 1
                    ? "One month"
                    : `${p.months} months`}
              </strong>
              <small>Pay once · No automatic renewal</small>
              {membershipSavings(p, monthly) && (
                <small className="membership-saving">
                  Save{" "}
                  {money(membershipSavings(p, monthly)!.amount, p.currency)} ·{" "}
                  {membershipSavings(p, monthly)!.percent}% versus monthly
                </small>
              )}
            </span>
            <b>{money(p.amount_centavos, p.currency)}</b>
          </label>
        ))}
      </fieldset>
      {plan ? (
        <div className="p3-checkout-total">
          <span>
            Total today
            <small>
              {plan.months} {plan.months === 1 ? "month" : "months"} of
              Explorer+
            </small>
          </span>
          <strong>{money(plan.amount_centavos, plan.currency)}</strong>
          {membershipSavings(plan, monthly) && (
            <span className="membership-saving">
              You save{" "}
              {money(membershipSavings(plan, monthly)!.amount, plan.currency)}{" "}
              compared with paying monthly.
            </span>
          )}
        </div>
      ) : (
        <p role="status">
          Membership plans are temporarily unavailable. Please try again later.
        </p>
      )}
      <button
        type="submit"
        className="upd-btn upd-btn--vip p3-payment-submit"
        disabled={!approved || !plan}
        data-pending-label="Opening secure checkout…"
      >
        Continue to payment
      </button>
      <p className="p3-checkout-help">
        You’ll choose your payment method on Xendit.
      </p>
      <p role="status" aria-live="polite" className="p3-checkout-feedback" />
      <p className="p3-checkout-terms">
        Read our <a href="/terms/">Terms of Service</a> and{" "}
        <a href="/refunds/">Refund Policy</a>.
      </p>
    </ValidatedForm>
  );
}
