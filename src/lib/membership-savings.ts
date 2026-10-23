type Plan = { months: number; amount_centavos: number; currency: string };
export function membershipSavings(plan: Plan, monthly?: Plan) {
  if (
    !monthly ||
    monthly.months !== 1 ||
    plan.months <= 1 ||
    plan.currency !== monthly.currency
  )
    return null;
  const baseline = monthly.amount_centavos * plan.months;
  const amount = baseline - plan.amount_centavos;
  if (amount <= 0 || !Number.isSafeInteger(baseline)) return null;
  return { amount, percent: Math.round((amount / baseline) * 1000) / 10 };
}
