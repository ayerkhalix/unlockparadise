import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const admin = "00000000-0000-4000-8000-000000000901",
  member = "00000000-0000-4000-8000-000000000902";
const target = "10000000-0000-4000-8000-000000000901",
  normal = "10000000-0000-4000-8000-000000000902",
  premium = "10000000-0000-4000-8000-000000000903";
const j = (value) =>
  "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
test("Place audiences and nearby links save atomically and preserve access restrictions", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${admin}'),('${member}'); insert into public.user_roles(user_id,role) values('${admin}','admin');
    insert into public.places(id,title,slug,status,vip_content) values('${target}','Targeted place','targeted','publish',false),('${normal}','Other place','normal','publish',false),('${premium}','Premium targeted','premium','publish',true);
    insert into public.place_details(place_id,traveler_types) values('${target}',array['identity-32']),('${normal}','{}'),('${premium}',array['identity-32']);
    update public.traveler_preferences set status='completed',interests=array['coffee'] where user_id='${member}';`);
  let found = (
    await asUser(db, member, "select id from public.traveler_featured(12)")
  ).rows.map((r) => r.id);
  assert.equal(found[0], target);
  assert.ok(!found.includes(premium));
  await db.exec(
    `update public.traveler_preferences set interests=array['beach'] where user_id='${member}'`,
  );
  found = (
    await asUser(db, member, "select id from public.traveler_featured(12)")
  ).rows.map((r) => r.id);
  assert.ok(!found.includes(target));
  assert.ok(found.includes(normal));
  assert.equal(
    (
      await asUser(
        db,
        member,
        `select id from public.places where id='${target}'`,
      )
    ).rows.length,
    1,
  );
  const nearby = [
    {
      id: "20000000-0000-4000-8000-000000000901",
      name: "Staff café",
      maps_url: "https://www.google.com/maps/place/Staff+Cafe/",
      google_place_id: "",
      kind: "coffee",
      note: "Editorial note",
    },
  ];
  const body = {
    title: "Targeted place",
    slug: "targeted",
    status: "publish",
    vip_content: false,
    premium_content: false,
    listing_types: ["destination"],
    travel_minutes: null,
    accessibility: [],
    assets: [],
    featured: false,
    feature_order: 0,
    description: "",
    content: "",
    excerpt: "",
    latitude: null,
    longitude: null,
    weekday_crowd: "",
    weekend_crowd: "",
    area_ids: [],
    category_ids: [],
    gallery: [],
    cover_id: null,
    traveler_types: ["identity-1"],
    nearby_places: nearby,
  };
  await assert.rejects(() =>
    asUser(
      db,
      member,
      `select public.admin_save_place('${target}',${j(body)})`,
    ),
  );
  await asUser(
    db,
    admin,
    `select public.admin_save_place('${target}',${j(body)})`,
    "aal2",
  );
  const saved = (
    await db.query(
      `select traveler_types,nearby_places from public.place_details where place_id='${target}'`,
    )
  ).rows[0];
  assert.deepEqual(saved.traveler_types, ["identity-1"]);
  assert.deepEqual(saved.nearby_places, nearby);
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      `select public.admin_save_place('${target}',${j({ ...body, title: "Must roll back", nearby_places: [{ ...nearby[0], maps_url: "https://example.com/" }] })})`,
      "aal2",
    ),
  );
  assert.equal(
    (await db.query(`select title from public.places where id='${target}'`))
      .rows[0].title,
    "Targeted place",
  );
  await assert.rejects(() =>
    db.exec(
      `update public.place_details set traveler_types=array['made-up'] where place_id='${target}'`,
    ),
  );
  await assert.rejects(() =>
    db.exec(
      `update public.place_details set nearby_places=${j([...nearby, nearby[0]])} where place_id='${target}'`,
    ),
  );
  const guest = await asUser(
    db,
    null,
    `select nearby_places from public.place_details where place_id='${premium}'`,
    "aal1",
    "anon",
  );
  assert.equal(guest.rows.length, 0);
});
