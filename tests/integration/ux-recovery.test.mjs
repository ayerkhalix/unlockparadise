import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const uid = "00000000-0000-4000-8000-000000000681",
  other = "00000000-0000-4000-8000-000000000682";
const area = "20000000-0000-4000-8000-000000000681",
  outside = "20000000-0000-4000-8000-000000000682";
const beach = "10000000-0000-4000-8000-000000000681",
  river = "10000000-0000-4000-8000-000000000682",
  far = "10000000-0000-4000-8000-000000000683";
const json = (v) => `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;
test("Undo restores itinerary order, notes and times atomically under owner, area and version guards", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${uid}'),('${other}');insert into public.entitlements(user_id,source,reason) values('${uid}','manual','Synthetic Undo'),('${other}','manual','Synthetic Undo');
 insert into public.areas(id,name,slug) values('${area}','Near','near'),('${outside}','Far','far');
 insert into public.places(id,title,slug,status) values('${beach}','Beach','undo-beach','publish'),('${river}','River','undo-river','publish'),('${far}','Far','undo-far','publish');
 insert into public.place_details(place_id) values('${beach}'),('${river}'),('${far}');insert into public.place_areas(place_id,area_id) values('${beach}','${area}'),('${river}','${area}'),('${far}','${outside}');`);
  const trip = (
    await asUser(
      db,
      uid,
      `select public.plan_itinerary(null,null,'create',${json({ title: "Undo", day_count: 1, area_id: area })}) id`,
    )
  ).rows[0].id;
  const day = (
    await db.query(
      `select id from public.itinerary_days where itinerary_id='${trip}'`,
    )
  ).rows[0].id;
  const call = (version, action, payload, user = uid) =>
    asUser(
      db,
      user,
      `select public.plan_itinerary('${trip}',${version},'${action}',${json(payload)})`,
    );
  await call(1, "add", {
    day_id: day,
    place_id: beach,
    start_time: "08:00",
    end_time: "10:00",
  });
  const item = (
    await db.query(
      `select id from public.itinerary_items where itinerary_id='${trip}'`,
    )
  ).rows[0].id;
  await call(2, "notes", { item_id: item, notes: "Bring water" });
  await call(3, "add", { day_id: day, place_id: river });
  await call(4, "remove", { item_id: item });
  const restore = {
    day_id: day,
    place_id: beach,
    position: 0,
    notes: "Bring water",
    start_time: "08:00",
    end_time: "10:00",
  };
  await assert.rejects(() => call(4, "restore", restore), /reload/);
  await assert.rejects(
    () => call(5, "restore", restore, other),
    /Trip not found/,
  );
  await assert.rejects(
    () => call(5, "restore", { ...restore, place_id: far }),
    /trip area/,
  );
  await assert.rejects(() =>
    call(5, "restore", { ...restore, notes: "x".repeat(2001) }),
  );
  await assert.rejects(() =>
    call(5, "restore", { ...restore, end_time: "07:00" }),
  );
  assert.equal(
    (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
    5,
  );
  await call(5, "restore", restore);
  const rows = (
    await db.query(
      `select place_id,position,notes,start_time::text,end_time::text from public.itinerary_items where itinerary_id='${trip}' order by position`,
    )
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.place_id),
    [beach, river],
  );
  assert.equal(rows[0].notes, "Bring water");
  assert.equal(rows[0].start_time, "08:00:00");
  assert.equal(rows[0].end_time, "10:00:00");
  assert.equal(
    (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
    6,
  );
  await assert.rejects(() => call(6, "restore", restore));
  await assert.rejects(
    () =>
      asUser(
        db,
        uid,
        `select private.plan_itinerary_before_recovery('${trip}',6,'add_day','{}')`,
      ),
    /permission denied/,
  );
});
