import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";

test("combined stop edits are atomic and preserve owner, premium and version guards", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const owner = "00000000-0000-4000-8000-000000000851",
    other = "00000000-0000-4000-8000-000000000852",
    area = "20000000-0000-4000-8000-000000000851";
  const places = [
    "10000000-0000-4000-8000-000000000851",
    "10000000-0000-4000-8000-000000000852",
  ];
  const json = (value) =>
    `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  await db.exec(
    `insert into auth.users(id) values('${owner}'),('${other}'); insert into public.entitlements(user_id,source,reason) values('${owner}','manual','Synthetic batch save'),('${other}','manual','Synthetic batch save'); insert into public.areas(id,name,slug) values('${area}','Batch','batch');`,
  );
  for (const [index, id] of places.entries())
    await db.exec(
      `insert into public.places(id,title,slug,status) values('${id}','Batch ${index}','batch-${index}','publish'); insert into public.place_details(place_id) values('${id}'); insert into public.place_areas values('${id}','${area}');`,
    );
  const trip = (
    await asUser(
      db,
      owner,
      `select public.plan_itinerary(null,null,'create',${json({ title: "Batch", day_count: 1, area_id: area })}) id`,
    )
  ).rows[0].id;
  const day = (
    await db.query(
      `select id from public.itinerary_days where itinerary_id='${trip}'`,
    )
  ).rows[0].id;
  for (const [index, id] of places.entries())
    await asUser(
      db,
      owner,
      `select public.plan_itinerary('${trip}',${index + 1},'add',${json({ day_id: day, place_id: id })})`,
    );
  const items = (
    await db.query(
      `select * from public.itinerary_items where itinerary_id='${trip}' order by position`,
    )
  ).rows;
  const edits = items.map((item, index) => ({
    item_id: item.id,
    notes: `Remember ${index}`,
    start_time: index ? "10:00" : "08:00",
    end_time: index ? "11:00" : "09:00",
  }));
  const save = (version, changes = edits, user = owner) =>
    asUser(
      db,
      user,
      `select public.save_itinerary_changes('${trip}',${version},${json(changes)})`,
    );
  const snapshot = async () => ({
    items: (
      await db.query(
        `select notes,start_time,end_time from public.itinerary_items where itinerary_id='${trip}' order by position`,
      )
    ).rows,
    version: (
      await db.query(
        `select version from public.itineraries where id='${trip}'`,
      )
    ).rows[0].version,
  });
  await save(3);
  const saved = await snapshot();
  assert.equal(saved.version, 7);
  assert.equal(saved.items[0].notes, "Remember 0");
  assert.equal(saved.items[1].start_time, "10:00:00");
  await assert.rejects(() => save(3), /reload/);
  await assert.rejects(() => save(7, edits, other), /Trip not found/);
  // A later failure rolls back an earlier valid row in the same batch.
  await assert.rejects(() =>
    save(7, [
      { ...edits[0], notes: "Must roll back" },
      { ...edits[1], start_time: "12:00", end_time: "11:00" },
    ]),
  );
  await assert.rejects(() => save(7, [edits[0], edits[0]]), /once/);
  await assert.rejects(() => save(7, []), /1 and 50/);
  await assert.rejects(
    () => save(7, [{ ...edits[0], item_id: other }]),
    /Stop not found/,
  );
  await assert.rejects(
    () =>
      asUser(
        db,
        null,
        `select public.save_itinerary_changes('${trip}',7,${json(edits)})`,
        "aal1",
        "anon",
      ),
    /permission/,
  );
  assert.deepEqual(await snapshot(), saved);
  await db.exec(`delete from public.entitlements where user_id='${owner}'`);
  await assert.rejects(() => save(7));
  assert.deepEqual(await snapshot(), saved);
});
