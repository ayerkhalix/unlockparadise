import { test } from "node:test";
import assert from "node:assert/strict";
import {
  xenditTestKey,
  xenditCheckoutUrl,
  verifyXenditToken,
  xenditCentavos,
  xenditSession,
  verifyXenditPayment,
  xenditReturnUrls,
} from "../../src/lib/payments/xendit-core";

test("Xendit return URLs require HTTPS and bind the confirmation to its transaction", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.deepEqual(xenditReturnUrls("http://127.0.0.1:3000", id), {});
  assert.deepEqual(
    xenditReturnUrls("https://staging.example.test/ignored", id),
    {
      success_return_url: `https://staging.example.test/checkout/?payment=return&transaction_id=${id}`,
      cancel_return_url:
        "https://staging.example.test/checkout/?payment=cancelled",
    },
  );
  assert.throws(() =>
    xenditReturnUrls("https://staging.example.test", "not-a-transaction"),
  );
});

test("Xendit rejects live keys, foreign checkout hosts and invalid callback tokens", () => {
  assert.equal(
    xenditTestKey("xnd_development_synthetic"),
    "xnd_development_synthetic",
  );
  for (const key of ["", "xnd_production_synthetic", "sk_test_wrong-provider"])
    assert.throws(() => xenditTestKey(key));
  assert.equal(
    xenditCheckoutUrl("https://checkout-staging.xendit.co/sessions/ps-abc"),
    "https://checkout-staging.xendit.co/sessions/ps-abc",
  );
  for (const url of [
    "https://checkout.xendit.co/",
    "https://dev.xen.to.evil.test/",
    "https://user@dev.xen.to/",
    "https://dev.xen.to:444/",
    "http://dev.xen.to/",
  ])
    assert.throws(() => xenditCheckoutUrl(url));
  assert.equal(verifyXenditToken("synthetic", "synthetic"), true);
  for (const [provided, expected] of [
    ["", ""],
    ["wrong", "synthetic"],
    ["synthetic", ""],
    ["x".repeat(2000), "synthetic"],
  ])
    assert.equal(verifyXenditToken(provided, expected), false);
});
test("Xendit PHP amounts convert to exact centavos without rounding untrusted fractions", () => {
  for (const [amount, cents] of [
    [50, 5000],
    [135, 13500],
    [420, 42000],
    [5.55, 555],
    [1999.01, 199901],
    [0.01, 1],
  ])
    assert.equal(xenditCentavos(amount), cents);
  for (const amount of [0, -1, 1.001, Infinity, NaN, 0.1 + 0.2, 1e12])
    assert.throws(() => xenditCentavos(amount));
});
const remote = {
  payment_session_id: "ps-661f87c614802d6c402cd82d",
  reference_id: "00000000-0000-4000-8000-000000000001",
  business_id: "synthetic-business",
  session_type: "PAY",
  mode: "PAYMENT_LINK",
  country: "PH",
  currency: "PHP",
  amount: 50,
  status: "COMPLETED",
  expires_at: "2026-10-21T12:00:00Z",
  payment_id: "py-1402feb0-bb79-47ae-9d1e-e69394d3949c",
  payment_request_id: "pr-synthetic",
};
const payment = {
  payment_id: remote.payment_id,
  business_id: remote.business_id,
  payment_request_id: remote.payment_request_id,
  type: "PAY",
  status: "SUCCEEDED",
  currency: "PHP",
  country: "PH",
  request_amount: 50,
  captures: [{ capture_id: "cap-synthetic", capture_amount: 50 }],
};
test("membership requires a matching captured payment, session, business and PHP total", () => {
  const session = xenditSession.parse(remote);
  assert.equal(
    xenditSession.parse({ ...remote, expires_at: undefined }).status,
    "COMPLETED",
  );
  assert.equal(
    verifyXenditPayment(session, payment, 5000).payment_id,
    remote.payment_id,
  );
  assert.equal(
    verifyXenditPayment(
      {
        ...session,
        payment_request_id: null,
        latest_payment_request_id: remote.payment_request_id,
      },
      payment,
      5000,
    ).payment_id,
    remote.payment_id,
  );
  for (const patch of [
    { status: "PENDING" },
    { payment_id: "py-wrong" },
    { business_id: "foreign" },
    { payment_request_id: "pr-foreign" },
    { currency: "USD" },
    { country: "ID" },
    { request_amount: 5000 },
    { captures: [] },
    { captures: [{ capture_id: "cap", capture_amount: 49 }] },
    {
      captures: [
        { capture_id: "cap", capture_amount: 25 },
        { capture_id: "cap", capture_amount: 25 },
      ],
    },
  ])
    assert.throws(() =>
      verifyXenditPayment(session, { ...payment, ...patch }, 5000),
    );
  assert.throws(() =>
    verifyXenditPayment({ ...session, status: "ACTIVE" }, payment, 5000),
  );
  assert.throws(() =>
    verifyXenditPayment({ ...session, amount: 5000 }, payment, 5000),
  );
  assert.throws(() =>
    xenditSession.parse({ ...remote, session_type: "SUBSCRIPTION" }),
  );
});
