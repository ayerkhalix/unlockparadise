import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";

test("reorder takes position time slots atomically, retains notes, and rejects stale, foreign or partial orders", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const uid = "00000000-0000-4000-8000-000000000691",
    other = "00000000-0000-4000-8000-000000000692";
  const area = "20000000-0000-4000-8000-000000000691";
  const places = [1, 2, 3].map(
    (n) => `10000000-0000-4000-8000-00000000069${n}`,
  );
  const json = (value) =>
    `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  await db.exec(
    `insert into auth.users(id) values('${uid}'),('${other}'); insert into public.entitlements(user_id,source,reason) values('${uid}','manual','Synthetic reorder'),('${other}','manual','Synthetic reorder'); insert into public.areas(id,name,slug) values('${area}','Slots','slots');`,
  );
  for (const [n, id] of places.entries())
    await db.exec(
      `insert into public.places(id,title,slug,status) values('${id}','Slot ${n}','slot-${n}','publish'); insert into public.place_details(place_id) values('${id}'); insert into public.place_areas values('${id}','${area}');`,
    );
  const trip = (
    await asUser(
      db,
      uid,
      `select public.plan_itinerary(null,null,'create',${json({ title: "Slots", day_count: 2, area_id: area })}) id`,
    )
  ).rows[0].id;
  const days = (
    await db.query(
      `select id from public.itinerary_days where itinerary_id='${trip}' order by day_number`,
    )
  ).rows;
  const call = (version, action, payload, user = uid) =>
    asUser(
      db,
      user,
      `select public.plan_itinerary('${trip}',${version},'${action}',${json(payload)})`,
    );
  for (const [n, id] of places.entries())
    await call(n + 1, "add", {
      day_id: days[0].id,
      place_id: id,
      ...(n < 2
        ? {
            start_time: `${n + 8}:00`.padStart(5, "0"),
            end_time: `${n + 9}:00`.padStart(5, "0"),
          }
        : {}),
    });
  let rows = (
    await db.query(
      `select * from public.itinerary_items where itinerary_id='${trip}' order by position`,
    )
  ).rows;
  await call(4, "notes", {
    item_id: rows[0].id,
    notes: "Destination-owned note",
  });
  const order = [rows[2].id, rows[0].id, rows[1].id],
    payload = { day_id: days[0].id, item_ids: order };
  await assert.rejects(() => call(4, "reorder", payload), /reload/);
  await assert.rejects(
    () => call(5, "reorder", payload, other),
    /Trip not found/,
  );
  await assert.rejects(
    () => call(5, "reorder", { ...payload, day_id: days[1].id }),
    /every stop/,
  );
  await assert.rejects(
    () => call(5, "reorder", { ...payload, item_ids: order.slice(0, 2) }),
    /every stop/,
  );
  await assert.rejects(
    () =>
      call(5, "reorder", {
        ...payload,
        item_ids: [order[0], order[0], order[2]],
      }),
    /every stop/,
  );
  assert.equal(
    (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
    5,
  );
  await call(5, "reorder", payload);
  rows = (
    await db.query(
      `select * from public.itinerary_items where itinerary_id='${trip}' order by position`,
    )
  ).rows;
  assert.deepEqual(
    rows.map((row) => row.id),
    order,
  );
  assert.deepEqual(
    rows.map((row) => row.start_time),
    ["08:00:00", "09:00:00", null],
  );
  assert.deepEqual(
    rows.map((row) => row.end_time),
    ["09:00:00", "10:00:00", null],
  );
  assert.equal(rows[1].notes, "Destination-owned note");
  assert.equal(
    (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
    6,
  );
  await call(6, "move", { item_id: rows[0].id, day_id: days[1].id });
  const moved = (
    await db.query(
      `select start_time,day_id from public.itinerary_items where id='${rows[0].id}'`,
    )
  ).rows[0];
  assert.equal(moved.start_time, "08:00:00");
  assert.equal(moved.day_id, days[1].id);
  const privileges = (
    await db.query(
      `select has_function_privilege('authenticated','private.plan_itinerary_before_time_slots(uuid,integer,text,jsonb)','execute') allowed`,
    )
  ).rows[0];
  assert.equal(privileges.allowed, false);
});
