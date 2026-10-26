import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";

test("delete day removes only its stops, closes the date gap, and preserves surviving identities, notes and slots", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const uid = "00000000-0000-4000-8000-000000000861",
    other = "00000000-0000-4000-8000-000000000862",
    free = "00000000-0000-4000-8000-000000000863";
  const area = "20000000-0000-4000-8000-000000000861",
    place = "10000000-0000-4000-8000-000000000861";
  const json = (value) =>
    `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  await db.exec(
    `insert into auth.users(id) values('${uid}'),('${other}'),('${free}'); insert into public.entitlements(user_id,source,reason) values('${uid}','manual','Synthetic deletion'),('${other}','manual','Synthetic deletion'); insert into public.areas(id,name,slug) values('${area}','Days','days'); insert into public.places(id,title,slug,status) values('${place}','Day stop','day-stop','publish'); insert into public.place_details(place_id) values('${place}'); insert into public.place_areas values('${place}','${area}');`,
  );
  const create = async (user, payload) =>
    (
      await asUser(
        db,
        user,
        `select public.plan_itinerary(null,null,'create',${json({ title: "Synthetic days", area_id: area, day_count: 4, ...payload })}) id`,
      )
    ).rows[0].id;
  const trip = await create(uid, {
      start_date: "2026-12-30",
      end_date: "2027-01-02",
    }),
    foreign = await create(other, { day_count: 2 });
  const days = (
    await db.query(
      `select * from public.itinerary_days where itinerary_id='${trip}' order by day_number`,
    )
  ).rows;
  const foreignDay = (
    await db.query(
      `select id from public.itinerary_days where itinerary_id='${foreign}' limit 1`,
    )
  ).rows[0].id;
  const call = (version, action, payload, user = uid) =>
    asUser(
      db,
      user,
      `select public.plan_itinerary('${trip}',${version},'${action}',${json(payload)})`,
    );
  let version = 1;
  for (const day of days) {
    await call(version++, "add", {
      day_id: day.id,
      place_id: place,
      start_time: "08:15",
      end_time: "10:45",
    });
    const item = (
      await db.query(
        `select id from public.itinerary_items where day_id='${day.id}'`,
      )
    ).rows[0].id;
    await call(version++, "notes", {
      item_id: item,
      notes: `Saved note ${day.day_number}`,
    });
  }
  const snapshot = async () =>
    (
      await db.query(
        `select jsonb_build_object('trip',(select to_jsonb(t) from public.itineraries t where id='${trip}'),'days',(select jsonb_agg(d order by day_number) from public.itinerary_days d where itinerary_id='${trip}'),'stops',(select jsonb_agg(i order by day_id) from public.itinerary_items i where itinerary_id='${trip}')) value`,
      )
    ).rows[0].value;
  const before = await snapshot();
  await assert.rejects(
    () => call(version - 1, "delete_day", { day_id: days[1].id }),
    /reload/,
  );
  await assert.rejects(
    () => call(version, "delete_day", { day_id: days[1].id }, other),
    /Trip not found/,
  );
  await assert.rejects(
    () => call(version, "delete_day", { day_id: days[1].id }, free),
    /Explorer\+/,
  );
  await assert.rejects(
    () => call(version, "delete_day", { day_id: foreignDay }),
    /Day not found/,
  );
  await assert.rejects(() => call(version, "delete_day", {}), /Day not found/);
  assert.deepEqual(await snapshot(), before);
  await call(version++, "delete_day", { day_id: days[1].id });
  const after = await snapshot();
  assert.equal(after.trip.start_date, "2026-12-30");
  assert.equal(after.trip.end_date, "2027-01-01");
  assert.equal(after.trip.version, version);
  assert.deepEqual(
    after.days.map((d) => d.id),
    [days[0].id, days[2].id, days[3].id],
  );
  assert.deepEqual(
    after.days.map((d) => d.day_number),
    [1, 2, 3],
  );
  assert.deepEqual(
    after.stops,
    before.stops.filter((stop) => stop.day_id !== days[1].id),
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.itinerary_days where itinerary_id='${foreign}'`,
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.places where id='${place}'`,
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    () => call(version - 1, "delete_day", { day_id: days[1].id }),
    /reload/,
  );
  await call(version++, "delete_day", { day_id: days[0].id });
  await call(version++, "delete_day", { day_id: days[3].id });
  const last = await snapshot();
  assert.equal(last.days[0].id, days[2].id);
  assert.equal(last.trip.end_date, "2026-12-30");
  await assert.rejects(
    () => call(version, "delete_day", { day_id: days[2].id }),
    /at least one/,
  );
  assert.deepEqual(await snapshot(), last);
  const privileges = (
    await db.query(
      `select has_function_privilege('authenticated','private.plan_itinerary_before_day_deletion(uuid,integer,text,jsonb)','execute') bypass,has_function_privilege('anon','public.plan_itinerary(uuid,integer,text,jsonb)','execute') anonymous`,
    )
  ).rows[0];
  assert.deepEqual(privileges, { bypass: false, anonymous: false });
  const flexible = await create(uid, { day_count: 60 });
  const first = (
    await db.query(
      `select id from public.itinerary_days where itinerary_id='${flexible}' and day_number=1`,
    )
  ).rows[0].id;
  await asUser(
    db,
    uid,
    `select public.plan_itinerary('${flexible}',1,'delete_day',${json({ day_id: first })})`,
  );
  const flexibleAfter = (
    await db.query(
      `select t.start_date,t.end_date,t.version,(select count(*)::int from public.itinerary_days where itinerary_id=t.id) days,(select max(day_number) from public.itinerary_days where itinerary_id=t.id) last from public.itineraries t where id='${flexible}'`,
    )
  ).rows[0];
  assert.deepEqual(flexibleAfter, {
    start_date: null,
    end_date: null,
    version: 2,
    days: 59,
    last: 59,
  });
});
