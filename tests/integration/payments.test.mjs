import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const user = "00000000-0000-4000-8000-000000000011";
test("payment reconciliation is atomic, idempotent and restricted to the trusted server", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id,email) values('${user}','synthetic@example.test');
 insert into public.payment_transactions(user_id,plan_id,provider_session_id,amount_centavos,idempotency_key,status)
 values('${user}','monthly','cs_synthetic_1',5000,'10000000-0000-4000-8000-000000000011','pending');`);
  await t.test("client cannot credit a checkout", async () => {
    await assert.rejects(() =>
      asUser(
        db,
        user,
        "select public.apply_paid_checkout('evt1','cs_synthetic_1','pay1',5000,'PHP','hash')",
      ),
    );
  });
  await t.test("amount mismatch rolls back the entire operation", async () => {
    await assert.rejects(() =>
      db.exec(
        "select public.apply_paid_checkout('evt1','cs_synthetic_1','pay1',50,'PHP','hash')",
      ),
    );
    assert.equal(
      (await db.query("select * from public.entitlements")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.payment_events")).rows.length,
      0,
    );
  });
  await t.test(
    "paid session activates once; repeated events do not extend access twice",
    async () => {
      await db.exec(
        "select public.apply_paid_checkout('evt1','cs_synthetic_1','pay1',5000,'PHP','hash')",
      );
      const first = (
        await db.query("select paid_through from public.subscriptions")
      ).rows[0].paid_through;
      await db.exec(
        "select public.apply_paid_checkout('evt1','cs_synthetic_1','pay1',5000,'PHP','hash')",
      );
      await db.exec(
        "select public.apply_paid_checkout('evt2','cs_synthetic_1','pay1',5000,'PHP','hash2')",
      );
      assert.equal(
        (
          await db.query("select paid_through from public.subscriptions")
        ).rows[0].paid_through.getTime(),
        first.getTime(),
      );
      assert.equal(
        (await db.query("select * from public.entitlements")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.notification_outbox")).rows
          .length,
        1,
      );
    },
  );
  await t.test(
    "renewal extends existing paid time and creates one history entry",
    async () => {
      await db.exec(
        `insert into public.payment_transactions(user_id,plan_id,provider_session_id,amount_centavos,idempotency_key,status) values('${user}','quarterly','cs_synthetic_2',13500,'10000000-0000-4000-8000-000000000012','pending');`,
      );
      const before = (
        await db.query("select paid_through from public.subscriptions")
      ).rows[0].paid_through;
      await db.exec(
        "select public.apply_paid_checkout('evt3','cs_synthetic_2','pay2',13500,'PHP','hash3')",
      );
      const after = (
        await db.query("select paid_through from public.subscriptions")
      ).rows[0].paid_through;
      assert.ok(after - before >= 89 * 86400000);
      assert.equal(
        (await db.query("select * from public.subscriptions")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.membership_history")).rows.length,
        2,
      );
    },
  );
  await t.test(
    "calendar month overflow preserves PHP billing behavior",
    async () => {
      const result = await db.query(
        "select private.php_add_months('2026-01-31 12:00:00+00',1) as date",
      );
      assert.equal(
        result.rows[0].date.toISOString(),
        "2026-03-03T12:00:00.000Z",
      );
    },
  );
  await t.test(
    "failed, refunded and expired paid records do not entitle",
    async () => {
      await db.exec(`update public.subscriptions set status='past_due'`);
      assert.equal(
        (await asUser(db, user, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        false,
      );
      await db.exec(`update public.subscriptions set status='refunded'`);
      assert.equal(
        (await asUser(db, user, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        false,
      );
      await db.exec(`update public.subscriptions set status='cancelled'`);
      assert.equal(
        (await asUser(db, user, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        true,
      );
      await db.exec(
        `update public.subscriptions set paid_through=now()-interval '1 second'`,
      );
      assert.equal(
        (await asUser(db, user, "select public.viewer_access() as access"))
          .rows[0].access.premium,
        false,
      );
    },
  );
});
