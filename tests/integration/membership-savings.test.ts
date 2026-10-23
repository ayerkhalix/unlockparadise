import { test } from "node:test";
import assert from "node:assert/strict";
import { membershipSavings } from "../../src/lib/membership-savings";
test("checkout savings follow active monthly pricing without inventing discounts", () => {
  const monthly = { months: 1, amount_centavos: 5000, currency: "PHP" };
  assert.deepEqual(
    membershipSavings(
      { months: 3, amount_centavos: 13500, currency: "PHP" },
      monthly,
    ),
    { amount: 1500, percent: 10 },
  );
  assert.deepEqual(
    membershipSavings(
      { months: 12, amount_centavos: 42000, currency: "PHP" },
      monthly,
    ),
    { amount: 18000, percent: 30 },
  );
  assert.equal(membershipSavings(monthly, monthly), null);
  assert.equal(
    membershipSavings(
      { months: 3, amount_centavos: 16000, currency: "PHP" },
      monthly,
    ),
    null,
  );
  assert.equal(
    membershipSavings(
      { months: 3, amount_centavos: 13500, currency: "USD" },
      monthly,
    ),
    null,
  );
  assert.equal(
    membershipSavings({ months: 3, amount_centavos: 13500, currency: "PHP" }),
    null,
  );
  assert.deepEqual(
    membershipSavings(
      { months: 3, amount_centavos: 13500, currency: "PHP" },
      { ...monthly, amount_centavos: 6000 },
    ),
    { amount: 4500, percent: 25 },
  );
});
