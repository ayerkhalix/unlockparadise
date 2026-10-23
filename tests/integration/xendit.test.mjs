import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const customer = "00000000-0000-4000-8000-000000000071";
const other = "00000000-0000-4000-8000-000000000072";
const key = "00000000-0000-4000-8000-000000000073";
const sid = "ps-661f87c614802d6c402cd82d";
const pay = "py-1402feb0-bb79-47ae-9d1e-e69394d3949c";
const service = (db, sql) => asUser(db, "", sql, "aal1", "service_role");

test("Xendit membership reservation, privilege isolation and exactly-once credit", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(
    `insert into auth.users(id,email) values('${customer}','synthetic-one@example.test'),('${other}','synthetic-two@example.test')`,
  );
  await t.test(
    "members cannot reserve or activate financial records directly",
    async () => {
      await assert.rejects(() =>
        asUser(
          db,
          customer,
          `select public.prepare_xendit_membership_checkout('${customer}','monthly','${key}')`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          customer,
          `select public.apply_xendit_membership_event('evt','${sid}','${pay}',5000,'PHP','hash','COMPLETED')`,
        ),
      );
    },
  );
  let tx;
  await t.test(
    "trusted preparation snapshots the actual price and duration; repeats reuse one checkout",
    async () => {
      const first = (
        await service(
          db,
          `select public.prepare_xendit_membership_checkout('${customer}','monthly','${key}') as result`,
        )
      ).rows[0].result;
      assert.equal(first.created, true);
      tx = first.transaction;
      assert.equal(tx.amount_centavos, 5000);
      assert.equal(tx.duration_months, 1);
      const repeat = (
        await service(
          db,
          `select public.prepare_xendit_membership_checkout('${customer}','monthly','${key}') as result`,
        )
      ).rows[0].result;
      assert.equal(repeat.created, false);
      assert.equal(repeat.transaction.id, tx.id);
      const another = (
        await service(
          db,
          `select public.prepare_xendit_membership_checkout('${customer}','monthly','00000000-0000-4000-8000-000000000074') as result`,
        )
      ).rows[0].result;
      assert.equal(another.created, false);
      assert.equal(another.transaction.id, tx.id);
      await assert.rejects(() =>
        service(
          db,
          `select public.prepare_xendit_membership_checkout('${other}','monthly','${key}')`,
        ),
      );
      await assert.rejects(() =>
        service(
          db,
          `select public.prepare_xendit_membership_checkout('${customer}','yearly','00000000-0000-4000-8000-000000000074')`,
        ),
      );
    },
  );
  await t.test(
    "session association rejects foreign hosts and cannot be reassigned",
    async () => {
      await assert.rejects(() =>
        service(
          db,
          `select public.attach_xendit_membership_session('${tx.id}','${sid}','https://evil.test/','business',now()+interval '30 minutes')`,
        ),
      );
      await service(
        db,
        `select public.attach_xendit_membership_session('${tx.id}','${sid}','https://checkout-staging.xendit.co/sessions/${sid}','business',now()+interval '30 minutes')`,
      );
      await assert.rejects(() =>
        service(
          db,
          `select public.attach_xendit_membership_session('${tx.id}','ps-661f87c614802d6c402cd82e','https://dev.xen.to/test','business',now()+interval '30 minutes')`,
        ),
      );
    },
  );
  await t.test(
    "provider and amount mismatch roll back events and entitlements",
    async () => {
      await assert.rejects(() =>
        service(
          db,
          `select public.apply_paid_checkout('evt-wrong-provider','${sid}','${pay}',5000,'PHP','hash')`,
        ),
      );
      await assert.rejects(() =>
        service(
          db,
          `select public.apply_xendit_membership_event('evt-wrong-amount','${sid}','${pay}',50,'PHP','hash','COMPLETED')`,
        ),
      );
      assert.equal(
        (await db.query("select count(*)::int n from public.entitlements"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (await db.query("select count(*)::int n from public.payment_events"))
          .rows[0].n,
        0,
      );
    },
  );
  await t.test(
    "completion activates once with the original duration; replay and expiry cannot downgrade it",
    async () => {
      await db.exec(
        "update public.membership_plans set months=12,amount_centavos=99900 where id='monthly'",
      );
      await service(
        db,
        `select public.apply_xendit_membership_event('xendit:${sid}:COMPLETED','${sid}','${pay}',5000,'PHP','hash','COMPLETED')`,
      );
      const before = (await db.query("select * from public.subscriptions"))
        .rows[0];
      assert.equal(before.provider, "xendit");
      assert.ok(before.paid_through - new Date() < 33 * 86400000);
      await service(
        db,
        `select public.apply_xendit_membership_event('xendit:${sid}:COMPLETED','${sid}','${pay}',5000,'PHP','hash','COMPLETED')`,
      );
      await service(
        db,
        `select public.apply_xendit_membership_event('another-delivery','${sid}','${pay}',5000,'PHP','hash','COMPLETED')`,
      );
      await service(
        db,
        `select public.apply_xendit_membership_event('late-expiry','${sid}','',5000,'PHP','hash','EXPIRED')`,
      );
      const after = (await db.query("select * from public.subscriptions"))
        .rows[0];
      assert.equal(after.paid_through.getTime(), before.paid_through.getTime());
      for (const table of [
        "entitlements",
        "membership_history",
        "notification_outbox",
      ])
        assert.equal(
          (await db.query(`select count(*)::int n from public.${table}`))
            .rows[0].n,
          1,
        );
      assert.equal(
        (await db.query("select status from public.payment_transactions"))
          .rows[0].status,
        "paid",
      );
      assert.equal(
        (await asUser(db, customer, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        true,
      );
    },
  );
  await t.test(
    "expiry releases checkout without access; a verified late capture can activate it once",
    async () => {
      const lateSid = "ps-661f87c614802d6c402cd82f";
      const latePay = "py-1402feb0-bb79-47ae-9d1e-e69394d3949e";
      const reserved = (
        await service(
          db,
          `select public.prepare_xendit_membership_checkout('${other}','quarterly','00000000-0000-4000-8000-000000000075') as r`,
        )
      ).rows[0].r;
      await service(
        db,
        `select public.attach_xendit_membership_session('${reserved.transaction.id}','${lateSid}','https://dev.xen.to/test','business',now()+interval '30 minutes')`,
      );
      await service(
        db,
        `select public.apply_xendit_membership_event('expired','${lateSid}','',13500,'PHP','hash','EXPIRED')`,
      );
      assert.equal(
        (await asUser(db, other, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        false,
      );
      await assert.rejects(() =>
        service(
          db,
          `select public.apply_xendit_membership_event('reused-payment','${lateSid}','${pay}',13500,'PHP','hash','COMPLETED')`,
        ),
      );
      await service(
        db,
        `select public.apply_xendit_membership_event('late-paid','${lateSid}','${latePay}',13500,'PHP','hash','COMPLETED')`,
      );
      assert.equal(
        (await asUser(db, other, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        true,
      );
    },
  );
});
