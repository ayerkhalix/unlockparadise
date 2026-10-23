import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const ids = {
  explorer: "00000000-0000-4000-8000-000000000001",
  premium: "00000000-0000-4000-8000-000000000002",
  expired: "00000000-0000-4000-8000-000000000003",
  admin: "00000000-0000-4000-8000-000000000004",
  other: "00000000-0000-4000-8000-000000000005",
};
const place = "10000000-0000-4000-8000-000000000001",
  vip = "10000000-0000-4000-8000-000000000002",
  draft = "10000000-0000-4000-8000-000000000003";
test("PostgreSQL RLS and RPC enforce the complete access matrix", async (t) => {
  const db = await database();
  t.after(() => db.close());
  for (const id of Object.values(ids))
    await db.exec(`insert into auth.users(id) values('${id}');`);
  await db.exec(`insert into public.places(id,title,slug,status,vip_content) values('${place}','Public','public','publish',false),('${vip}','VIP','vip','publish',true),('${draft}','Draft','draft','draft',false);
 insert into public.place_details(place_id,description,latitude,longitude) values('${place}','Member content',10,118),('${vip}','Premium secret',11,119),('${draft}','Unpublished secret',12,120);
 insert into public.user_roles(user_id,role) values('${ids.admin}','admin');
 insert into public.entitlements(user_id,source,starts_at,expires_at,reason) values('${ids.premium}','manual',now()-interval '2 days',now()+interval '1 day','Synthetic test grant'),('${ids.expired}','manual',now()-interval '2 days',now()-interval '1 day','Expired synthetic grant');`);
  await t.test(
    "anonymous reads ordinary published rows without premium identities or details",
    async () => {
      assert.equal(
        (await asUser(db, null, "select * from public.places", "aal1", "anon"))
          .rows.length,
        1,
      );
      assert.equal(
        (
          await asUser(
            db,
            null,
            "select * from public.place_details",
            "aal1",
            "anon",
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "Explorer gets ordinary details only; profile flags cannot grant premium",
    async () => {
      const rows = (
        await asUser(db, ids.explorer, "select * from public.place_details")
      ).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].place_id, place);
      await assert.rejects(() =>
        asUser(
          db,
          ids.explorer,
          `insert into public.user_roles(user_id,role) values('${ids.explorer}','admin')`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          ids.explorer,
          `insert into public.entitlements(user_id,source,reason) values('${ids.explorer}','manual','fraud')`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          ids.explorer,
          `update public.profiles set legacy_id=123 where id='${ids.explorer}'`,
        ),
      );
    },
  );
  await t.test(
    "Explorer+ sees premium; expiry and revocation close access immediately",
    async () => {
      assert.equal(
        (await asUser(db, ids.premium, "select * from public.place_details"))
          .rows.length,
        2,
      );
      assert.equal(
        (await asUser(db, ids.expired, "select * from public.place_details"))
          .rows.length,
        1,
      );
      await db.exec(
        `update public.entitlements set revoked_at=now() where user_id='${ids.premium}'`,
      );
      assert.equal(
        (await asUser(db, ids.premium, "select * from public.place_details"))
          .rows.length,
        1,
      );
      await db.exec(
        `update public.entitlements set revoked_at=null where user_id='${ids.premium}'`,
      );
    },
  );
  await t.test("admin needs MFA for content and mutation access", async () => {
    assert.equal(
      (await asUser(db, ids.admin, "select * from public.places")).rows.length,
      1,
    );
    assert.equal(
      (await asUser(db, ids.admin, "select * from public.places", "aal2")).rows
        .length,
      3,
    );
    assert.equal(
      (
        await asUser(
          db,
          ids.admin,
          `update public.places set title='Changed' where id='${place}' returning id`,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(
          db,
          ids.admin,
          `update public.places set title='Changed' where id='${place}' returning id`,
          "aal2",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(() =>
      asUser(
        db,
        ids.admin,
        `delete from public.user_roles where user_id='${ids.admin}'`,
        "aal2",
      ),
    );
  });
  await t.test(
    "saved/visited transitions are atomic, premium-only and isolated",
    async () => {
      await assert.rejects(() =>
        asUser(
          db,
          ids.explorer,
          `select public.set_member_place('${place}','save')`,
        ),
      );
      await asUser(
        db,
        ids.premium,
        `select public.set_member_place('${place}','save')`,
      );
      await asUser(
        db,
        ids.premium,
        `select public.set_member_place('${place}','save')`,
      );
      assert.equal(
        (await asUser(db, ids.premium, "select * from public.member_places"))
          .rows.length,
        1,
      );
      assert.equal(
        (await asUser(db, ids.other, "select * from public.member_places")).rows
          .length,
        0,
      );
      await asUser(
        db,
        ids.premium,
        `select public.set_member_place('${place}','visit')`,
      );
      let row = (
        await asUser(db, ids.premium, "select * from public.member_places")
      ).rows[0];
      assert.equal(row.saved_at, null);
      assert.ok(row.visited_at);
      await asUser(
        db,
        ids.premium,
        `select public.set_member_place('${place}','save')`,
      );
      await asUser(
        db,
        ids.premium,
        `select public.set_member_place('${place}','unsave')`,
      );
      row = (
        await asUser(db, ids.premium, "select * from public.member_places")
      ).rows[0];
      assert.ok(row.visited_at);
      await assert.rejects(() =>
        asUser(
          db,
          ids.premium,
          `insert into public.member_places values('${ids.other}','${place}',now(),null)`,
        ),
      );
    },
  );
  await t.test(
    "reviews enforce ownership, one-per-place, moderation and no editing",
    async () => {
      await asUser(
        db,
        ids.explorer,
        `insert into public.reviews(place_id,user_id,author_name,rating,body,status) values('${place}','${ids.other}','Impersonated',5,'Review','rejected')`,
      );
      const row = (await db.query("select * from public.reviews")).rows[0];
      assert.equal(row.user_id, ids.explorer);
      assert.equal(row.author_name, "Explorer");
      assert.equal(row.status, "approved");
      await assert.rejects(() =>
        asUser(
          db,
          ids.explorer,
          `insert into public.reviews(place_id,user_id,author_name,rating) values('${place}','${ids.explorer}','Explorer',5)`,
        ),
      );
      assert.equal(
        (
          await asUser(
            db,
            ids.explorer,
            `update public.reviews set rating=1 returning id`,
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await asUser(db, ids.other, "delete from public.reviews returning id"))
          .rows.length,
        0,
      );
      await db.exec(
        `update public.app_settings set value='"hold"' where key='review_moderation'`,
      );
      await asUser(
        db,
        ids.premium,
        `insert into public.reviews(place_id,user_id,author_name,rating,status) values('${vip}','${ids.premium}','Explorer',5,'approved')`,
      );
      assert.equal(
        (await asUser(db, null, "select * from public.reviews", "aal1", "anon"))
          .rows.length,
        1,
      );
      assert.equal(
        (await asUser(db, ids.premium, "select * from public.reviews")).rows
          .length,
        2,
      );
    },
  );
  await t.test(
    "private storage and metadata cannot be enumerated across users",
    async () => {
      const mid = "20000000-0000-4000-8000-000000000001";
      await db.exec(`insert into public.media(id,bucket,object_path,mime_type,byte_size,status) values('${mid}','destination-private','private.jpg','image/jpeg',10,'ready');
  insert into public.place_media values('${vip}','${mid}','gallery',0);
  insert into storage.objects(bucket_id,name) values('destination-private','private.jpg');`);
      assert.equal(
        (
          await asUser(
            db,
            null,
            "select * from storage.objects",
            "aal1",
            "anon",
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await asUser(db, ids.explorer, "select * from public.media")).rows
          .length,
        0,
      );
      assert.equal(
        (await asUser(db, ids.premium, "select * from storage.objects")).rows
          .length,
        1,
      );
      await assert.rejects(() =>
        asUser(
          db,
          ids.explorer,
          `insert into storage.objects(bucket_id,name) values('destination-public','attack.svg')`,
        ),
      );
    },
  );
  await t.test(
    "privileged payment RPCs and customer data remain inaccessible",
    async () => {
      await assert.rejects(() =>
        asUser(
          db,
          ids.premium,
          `select public.apply_paid_checkout('event','session','payment',5000,'PHP','hash')`,
        ),
      );
      assert.equal(
        (await asUser(db, ids.explorer, "select * from public.audit_logs")).rows
          .length,
        0,
      );
      assert.equal(
        (await asUser(db, ids.explorer, "select * from public.profiles")).rows
          .length,
        1,
      );
    },
  );
});
