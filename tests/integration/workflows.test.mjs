import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const admin = "00000000-0000-4000-8000-000000000031",
  member = "00000000-0000-4000-8000-000000000032",
  editor = "00000000-0000-4000-8000-000000000033";
const oldPhoto = "20000000-0000-4000-8000-000000000031",
  pendingPhoto = "20000000-0000-4000-8000-000000000032",
  cover = "20000000-0000-4000-8000-000000000033",
  place = "10000000-0000-4000-8000-000000000031";
test("signup, moderation, editor scope and direct deletion enforce verified workflows", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${admin}'),('${editor}');
 insert into auth.users(id,raw_user_meta_data) values('${member}','{"terms_accepted":true,"role":"admin","premium":true}');
 insert into public.user_roles(user_id,role) values('${admin}','admin'),('${editor}','editor');`);
  await t.test(
    "signup records consent but ignores privilege metadata",
    async () => {
      const profile = (
        await db.query(`select * from public.profiles where id='${member}'`)
      ).rows[0];
      assert.ok(profile.terms_accepted_at);
      const access = (
        await asUser(db, member, "select public.viewer_access() as value")
      ).rows[0].value;
      assert.equal(access.admin, false);
      assert.equal(access.premium, false);
      await assert.rejects(() =>
        asUser(
          db,
          member,
          `update public.profiles set terms_accepted_at=now() where id='${member}'`,
        ),
      );
    },
  );
  await t.test(
    "held photo preserves the approved photo until staff approval",
    async () => {
      await db.exec(`insert into public.media(id,owner_id,bucket,object_path,mime_type,byte_size,status) values
  ('${oldPhoto}','${member}','profile-private','old.webp','image/webp',10,'ready'),('${pendingPhoto}','${member}','profile-private','pending.webp','image/webp',10,'pending');
  insert into public.profile_media(user_id,media_id,pending_media_id) values('${member}','${oldPhoto}','${pendingPhoto}');`);
      assert.equal(
        (await db.query("select * from public.profile_media")).rows[0].media_id,
        oldPhoto,
      );
      await asUser(
        db,
        admin,
        `update public.media set status='ready' where id='${pendingPhoto}'`,
        "aal2",
      );
      const row = (await db.query("select * from public.profile_media"))
        .rows[0];
      assert.equal(row.media_id, pendingPhoto);
      assert.equal(row.pending_media_id, null);
    },
  );
  await t.test(
    "content editor cannot change settings or expose account metrics",
    async () => {
      const metrics = (
        await asUser(
          db,
          editor,
          "select public.admin_metrics() as value",
          "aal2",
        )
      ).rows[0].value;
      assert.equal(metrics.accounts, null);
      assert.equal(metrics.active_memberships, null);
      const changed = await asUser(
        db,
        editor,
        `update public.app_settings set value='"public"' where key='place_gate' returning key`,
        "aal2",
      );
      assert.equal(changed.rows.length, 0);
    },
  );
  await t.test(
    "media deletion refuses associations and direct Place deletion is denied",
    async () => {
      await db.exec(`insert into public.places(id,title,slug,status) values('${place}','Synthetic','workflow-place','archived');
  insert into public.media(id,bucket,object_path,mime_type,byte_size,status) values('${cover}','destination-public','cover.webp','image/webp',10,'ready');
  insert into public.place_media values('${place}','${cover}','cover',0);`);
      await assert.rejects(() =>
        asUser(
          db,
          admin,
          `select public.admin_prepare_media_delete('${cover}')`,
          "aal2",
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          admin,
          `delete from public.places where id='${place}'`,
          "aal2",
        ),
      );
      const result = await asUser(
        db,
        admin,
        `select public.admin_prepare_media_delete('${oldPhoto}') as value`,
        "aal2",
      );
      assert.equal(result.rows[0].value.object_path, "old.webp");
      assert.equal(
        (
          await db.query(
            `select status from public.media where id='${oldPhoto}'`,
          )
        ).rows[0].status,
        "rejected",
      );
    },
  );
});
