import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
import { newTripInput } from "../../src/lib/planning.ts";
const owner = "00000000-0000-4000-8000-000000000581",
  other = "00000000-0000-4000-8000-000000000582";
const north = "20000000-0000-4000-8000-000000000581",
  south = "20000000-0000-4000-8000-000000000582";
const beach = "10000000-0000-4000-8000-000000000581",
  river = "10000000-0000-4000-8000-000000000582";
const json = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
test("one trip area is enforced atomically without deleting existing trips", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${owner}'),('${other}');
    insert into public.entitlements(user_id,source,reason) values('${owner}','manual','Synthetic area check'),('${other}','manual','Synthetic area check');
    insert into public.areas(id,name,slug) values('${north}','North','north'),('${south}','South','south');
    insert into public.places(id,slug,title,status) values('${beach}','area-beach','Beach','publish'),('${river}','area-river','River','publish');
    insert into public.place_details(place_id) values('${beach}'),('${river}');
    insert into public.place_areas(place_id,area_id) values('${beach}','${north}'),('${river}','${south}');`);
  const create = (payload) =>
    asUser(
      db,
      owner,
      `select public.plan_itinerary(null,null,'create',${json({ title: "Area test", day_count: 2, ...payload })}) id`,
    );
  assert.equal(
    newTripInput.safeParse({
      title: "Test",
      notes: "",
      start_date: null,
      end_date: null,
      day_count: 1,
    }).success,
    false,
  );
  for (const payload of [{}, { area_id: [north, south] }, { area_id: other }])
    await assert.rejects(() => create(payload));
  const trip = (await create({ area_id: north })).rows[0].id;
  const days = (
    await db.query(
      `select id from public.itinerary_days where itinerary_id='${trip}' order by day_number`,
    )
  ).rows;
  const mutate = (version, action, payload, user = owner) =>
    asUser(
      db,
      user,
      `select public.plan_itinerary('${trip}',${version},'${action}',${json(payload)})`,
    );
  await assert.rejects(
    () => mutate(1, "add", { day_id: days[0].id, place_id: river }),
    /trip area/,
  );
  assert.equal(
    (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
    1,
  );
  await mutate(1, "add", { day_id: days[1].id, place_id: beach });
  await assert.rejects(
    () =>
      mutate(2, "update", {
        title: "Wrong area",
        day_count: 2,
        area_id: south,
      }),
    /Remove destinations/,
  );
  await assert.rejects(() => mutate(1, "add_day", {}), /reload/);
  await assert.rejects(
    () =>
      mutate(
        2,
        "update",
        { title: "Foreign", day_count: 2, area_id: north },
        other,
      ),
    /Trip not found/,
  );
  assert.equal(
    (
      await db.query(
        `select area_id from public.itineraries where id='${trip}'`,
      )
    ).rows[0].area_id,
    north,
  );
  // Simulate a pre-migration itinerary: no area is inferred and its notes/stops survive.
  await db.exec(
    `update public.itineraries set area_id=null where id='${trip}'`,
  );
  await assert.rejects(
    () => mutate(2, "add", { day_id: days[0].id, place_id: beach }),
    /Choose an area/,
  );
  await mutate(2, "update", {
    title: "Area test",
    notes: "Kept",
    day_count: 2,
    area_id: north,
  });
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.itinerary_items where itinerary_id='${trip}'`,
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
    3,
  );
  await assert.rejects(
    () =>
      asUser(
        db,
        owner,
        `select private.plan_itinerary_before_area('${trip}',3,'add_day','{}')`,
      ),
    /permission denied/,
  );
});
