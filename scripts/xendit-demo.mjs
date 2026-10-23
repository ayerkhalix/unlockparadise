// Local operator tool only. No simulator endpoint is exposed by the website.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  assertStagingProject,
  assertStagingFixture,
} from "./staging-project.mjs";
import {
  xenditTestKey,
  xenditSession,
  xenditCentavos,
} from "../src/lib/payments/xendit-core.ts";

async function main() {
  const project = assertStagingProject();
  assert.equal(process.env.UPD_ENVIRONMENT, "staging", "Staging is required.");
  assert.equal(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
    `${project}.supabase.co`,
    "Pinned test project is required.",
  );
  const key = xenditTestKey();
  const operation = process.argv[2] || "status";
  const account =
    process.argv.find((arg) => arg.startsWith("--account="))?.slice(10) ||
    "explorer";
  assert.ok(
    ["status", "simulate"].includes(operation),
    "Use status or simulate.",
  );
  assert.ok(
    ["explorer", "expired", "payment-demo"].includes(account),
    "Use explorer, expired or payment-demo.",
  );
  const fixture = JSON.parse(
    await readFile(
      account === "payment-demo"
        ? "artifacts/staging-private/xendit.json"
        : "artifacts/staging-private/identities.json",
      "utf8",
    ),
  );
  assertStagingFixture(fixture);
  const user = account === "payment-demo" ? fixture : fixture.users[account];
  assert.ok(
    (process.env.XENDIT_TEST_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .includes(user.id),
    "Account is not approved for Xendit testing.",
  );
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await db
    .from("payment_transactions")
    .select(
      "id,status,amount_centavos,provider_session_id,provider_business_id",
    )
    .eq("user_id", user.id)
    .eq("provider", "xendit")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error("Could not read the test checkout.");
  if (!result.data) {
    console.log(
      "No test checkout yet. Sign in with the demo Explorer account, open /checkout/, and choose Continue to payment.",
    );
    return;
  }
  const tx = result.data;
  console.log(
    `Test account: ${account}. Website payment: ${tx.status}. Amount: PHP ${(tx.amount_centavos / 100).toFixed(2)}.`,
  );
  if (operation === "status") return;
  if (tx.status === "paid") {
    console.log(
      "This payment is already confirmed. Open /account/ to show the Explorer+ membership.",
    );
    return;
  }
  assert.ok(
    ["pending", "creating"].includes(tx.status),
    "Start a new checkout before simulating.",
  );
  assert.match(
    tx.provider_session_id || "",
    /^ps-[a-f0-9]{24}$/,
    "The test checkout is not ready.",
  );
  const headers = {
    Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
    "Content-Type": "application/json",
    "api-version": "2024-11-11",
  };
  const getSession = async () => {
    const response = await fetch(
      `https://api.xendit.co/sessions/${tx.provider_session_id}`,
      { headers, redirect: "error", signal: AbortSignal.timeout(20000) },
    );
    if (!response.ok)
      throw new Error(`Xendit session lookup failed (${response.status}).`);
    const remote = xenditSession.parse(await response.json());
    assert.equal(remote.reference_id, tx.id, "Payment reference mismatch.");
    assert.equal(
      remote.business_id,
      tx.provider_business_id,
      "Merchant mismatch.",
    );
    assert.equal(
      xenditCentavos(remote.amount),
      tx.amount_centavos,
      "Amount mismatch.",
    );
    return remote;
  };
  let remote = await getSession();
  if (remote.status === "COMPLETED") {
    console.log(
      "Xendit has already completed this test payment. Return to /checkout/ and choose Check payment status.",
    );
    return;
  }
  assert.equal(
    remote.status,
    "ACTIVE",
    "The checkout has closed. Start a new checkout.",
  );
  const requestId =
    remote.latest_payment_request_id || remote.payment_request_id;
  assert.match(
    requestId || "",
    /^pr-[a-f0-9-]{36}$/,
    "On Xendit, select QR Ph and choose Pay with QR Ph first.",
  );
  const simulation = await fetch(
    `https://api.xendit.co/v3/payment_requests/${requestId}/simulate`,
    {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ amount: remote.amount }),
    },
  );
  if (!simulation.ok)
    throw new Error(`Xendit test simulation failed (${simulation.status}).`);
  console.log("Test-only simulation requested. No real money is collected.");
  for (let attempt = 0; attempt < 10; attempt++) {
    remote = await getSession();
    if (remote.status === "COMPLETED") {
      console.log(
        "Xendit confirms the test payment. Return to /checkout/ and choose Check payment status to activate Explorer+.",
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  console.log(
    "Xendit is still processing. Wait briefly, then choose Check payment status on the website.",
  );
}
main().catch((error) => {
  // Do not print provider responses, headers, tokens, passwords or SDK objects.
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : error instanceof Error && error.message.startsWith("Xendit")
        ? error.message
        : "Demo could not run. Check the local staging configuration.",
  );
  process.exitCode = 1;
});
