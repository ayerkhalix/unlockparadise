import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const admin = "00000000-0000-4000-8000-000000000021",
  explorer = "00000000-0000-4000-8000-000000000022";
test("admin CRUD is transactional, MFA-protected, audited and safeguards deletion", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(
    `insert into auth.users(id) values('${admin}'),('${explorer}');insert into public.user_roles(user_id,role) values('${admin}','admin');`,
  );
  const body = {
    title: "Synthetic Place",
    slug: "synthetic-place",
    status: "draft",
    vip_content: true,
    premium_content: false,
    listing_types: ["destination"],
    travel_minutes: 50,
    accessibility: ["Car"],
    assets: [],
    featured: false,
    feature_order: 0,
    description: "Description",
    journey_start: "City terminal",
    content: "",
    excerpt: "",
    latitude: 10,
    longitude: 118,
    weekday_crowd: "",
    weekend_crowd: "",
    area_ids: [],
    category_ids: [],
    cover_id: null,
    gallery: [],
  };
  const call = (pid, value) =>
    `select public.admin_save_place(${pid ? `'${pid}'` : "null"},'${JSON.stringify(value)}'::jsonb) as id`;
  await assert.rejects(() => asUser(db, explorer, call(null, body)));
  await assert.rejects(() => asUser(db, admin, call(null, body)));
  const id = (await asUser(db, admin, call(null, body), "aal2")).rows[0].id;
  assert.ok(id);
  assert.equal(
    (
      await db.query(
        `select journey_start from public.place_details where place_id='${id}'`,
      )
    ).rows[0].journey_start,
    "City terminal",
  );
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      call(id, { ...body, journey_start: "", title: "Should roll back" }),
      "aal2",
    ),
  );
  assert.equal(
    (await db.query(`select title from public.places where id='${id}'`)).rows[0]
      .title,
    body.title,
  );
  assert.equal(
    (await asUser(db, explorer, "select * from public.places")).rows.length,
    0,
  );
  await asUser(
    db,
    admin,
    call(id, { ...body, status: "publish", slug: "synthetic-new" }),
    "aal2",
  );
  assert.equal(
    (await asUser(db, explorer, "select * from public.places")).rows.length,
    0,
  );
  // Publishing a premium Place preserves the member gate; authorized staff can see it.
  assert.equal(
    (await asUser(db, admin, "select * from public.places", "aal2")).rows
      .length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select * from public.place_redirects where slug='synthetic-place'",
      )
    ).rows.length,
    1,
  );
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      `select public.admin_delete_place('${id}','synthetic-new')`,
      "aal2",
    ),
  );
  await asUser(
    db,
    admin,
    call(id, { ...body, status: "archived", slug: "synthetic-new" }),
    "aal2",
  );
  await asUser(
    db,
    admin,
    `select public.admin_delete_place('${id}','synthetic-new')`,
    "aal2",
  );
  assert.equal((await db.query("select * from public.places")).rows.length, 0);
  assert.ok(
    (
      await db.query(
        "select * from public.audit_logs where table_name='places'",
      )
    ).rows.length >= 4,
  );
});
