import { test } from "node:test";
import assert from "node:assert/strict";
import { stopTimeInput, stopTimeLabel } from "../../src/lib/planning.ts";

test("stop times use complete same-day ranges and readable durations", () => {
  assert.equal(
    stopTimeLabel("08:00:00", "12:00:00"),
    "8:00 AM – 12:00 PM · 4h",
  );
  assert.equal(stopTimeLabel("13:00", "15:30"), "1:00 PM – 3:30 PM · 2h 30m");
  assert.equal(
    stopTimeInput.safeParse({ start_time: null, end_time: null }).success,
    true,
  );
  for (const value of [
    { start_time: "08:00", end_time: null },
    { start_time: "12:00", end_time: "08:00" },
    { start_time: "08:00", end_time: "08:00" },
    { start_time: "23:00", end_time: "24:00" },
  ])
    assert.equal(stopTimeInput.safeParse(value).success, false);
});
import { database, asUser } from "./database.mjs";
const owner = "00000000-0000-4000-8000-000000000201",
  other = "00000000-0000-4000-8000-000000000202",
  admin = "00000000-0000-4000-8000-000000000203";
const beach = "10000000-0000-4000-8000-000000000201",
  river = "10000000-0000-4000-8000-000000000202",
  vip = "10000000-0000-4000-8000-000000000203";
const area = "20000000-0000-4000-8000-000000000201";
const sqlJSON = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
test("Phase 2 ownership, atomic ordering, content access and recommendations", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${owner}'),('${other}'),('${admin}');insert into public.user_roles(user_id,role) values('${admin}','admin');
 insert into public.places(id,slug,title,status,vip_content) values('${beach}','test-beach','Test Beach','publish',false),('${river}','test-river','Test River','publish',false),('${vip}','test-vip','Restricted','publish',true);
 insert into public.entitlements(user_id,source,reason) values('${owner}','manual','Synthetic planner member');
 insert into public.areas(id,name,slug) values('${area}','Test area','test-area'); insert into public.place_areas(place_id,area_id) values('${beach}','${area}'),('${river}','${area}'),('${vip}','${area}');
 insert into public.place_details(place_id) values('${beach}'),('${river}'),('${vip}');`);
  let trip,
    days,
    version = 1;
  const mutate = async (action, payload, user = owner, v = version) => {
    const result = await asUser(
      db,
      user,
      `select public.plan_itinerary('${trip}',${v},'${action}',${sqlJSON(payload)})`,
    );
    if (user === owner) version++;
    return result;
  };
  await t.test(
    "Explorer+ creation persists days and isolates all three tables",
    async () => {
      trip = (
        await asUser(
          db,
          owner,
          `select public.plan_itinerary(null,null,'create',${sqlJSON({ area_id: area, title: "Palawan test", start_date: "2026-11-01", end_date: "2026-11-03", day_count: 3 })}) as id`,
        )
      ).rows[0].id;
      days = (
        await asUser(
          db,
          owner,
          `select * from public.itinerary_days where itinerary_id='${trip}' order by day_number`,
        )
      ).rows;
      assert.equal(days.length, 3);
      for (const table of ["itineraries", "itinerary_days", "itinerary_items"])
        assert.equal(
          (await asUser(db, other, `select * from public.${table}`)).rows
            .length,
          0,
        );
      await assert.rejects(() =>
        asUser(db, null, "select * from public.itineraries", "aal1", "anon"),
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `insert into public.itineraries(user_id,title) values('${other}','Intrusion')`,
        ),
      );
      await assert.rejects(() => mutate("delete", {}, other));
    },
  );
  await t.test(
    "no dates reinterpreted; invalid date ranges rejected",
    async () => {
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `select public.plan_itinerary(null,null,'create',${sqlJSON({ area_id: area, title: "Bad", start_date: "2026-11-03", end_date: "2026-11-01", day_count: 3 })})`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `select public.plan_itinerary(null,null,'create',${sqlJSON({ area_id: area, title: "Bad", start_date: "2026-11-03", end_date: null, day_count: 3 })})`,
        ),
      );
    },
  );
  await t.test(
    "add checks access and duplicates; does not save to Bucketlist",
    async () => {
      await mutate("add", {
        day_id: days[0].id,
        place_id: beach,
        start_time: "08:00",
        end_time: "12:00",
      });
      await mutate("add", { day_id: days[0].id, place_id: river });
      await assert.rejects(() =>
        mutate("add", { day_id: days[0].id, place_id: beach }),
      );
      await assert.rejects(() =>
        mutate("add", { day_id: days[0].id, place_id: vip }, other),
      );
      assert.equal(
        (await asUser(db, owner, "select * from public.member_places")).rows
          .length,
        0,
      );
      assert.equal(
        (await asUser(db, other, "select * from public.itinerary_items")).rows
          .length,
        0,
      );
    },
  );
  await t.test(
    "visit times persist, reject partial/backward ranges and retain owner/version isolation",
    async () => {
      const item = (
        await asUser(
          db,
          owner,
          `select * from public.itinerary_items where itinerary_id='${trip}' and place_id='${beach}'`,
        )
      ).rows[0];
      assert.equal(item.start_time, "08:00:00");
      assert.equal(item.end_time, "12:00:00");
      await assert.rejects(() =>
        mutate(
          "schedule",
          { item_id: item.id, start_time: "13:00", end_time: "15:00" },
          other,
        ),
      );
      for (const times of [
        { start_time: "13:00", end_time: null },
        { start_time: "15:00", end_time: "13:00" },
        { start_time: "13:00", end_time: "13:00" },
      ])
        await assert.rejects(() =>
          mutate("schedule", { item_id: item.id, ...times }),
        );
      await mutate("schedule", {
        item_id: item.id,
        start_time: "13:00",
        end_time: "15:00",
      });
      assert.equal(
        (
          await asUser(
            db,
            owner,
            `select end_time from public.itinerary_items where id='${item.id}'`,
          )
        ).rows[0].end_time,
        "15:00:00",
      );
      await mutate("schedule", {
        item_id: item.id,
        start_time: null,
        end_time: null,
      });
      const cleared = (
        await asUser(
          db,
          owner,
          `select start_time,end_time from public.itinerary_items where id='${item.id}'`,
        )
      ).rows[0];
      assert.deepEqual(cleared, { start_time: null, end_time: null });
    },
  );
  let items;
  await t.test(
    "complete reorder is atomic and stale versions are rejected",
    async () => {
      items = (
        await asUser(
          db,
          owner,
          `select * from public.itinerary_items where day_id='${days[0].id}' order by position`,
        )
      ).rows;
      await mutate("reorder", {
        day_id: days[0].id,
        item_ids: items.map((i) => i.id).reverse(),
      });
      assert.equal(
        (
          await asUser(
            db,
            owner,
            `select place_id from public.itinerary_items where day_id='${days[0].id}' order by position`,
          )
        ).rows[0].place_id,
        river,
      );
      await assert.rejects(() =>
        mutate("reorder", {
          day_id: days[0].id,
          item_ids: [items[0].id, items[0].id],
        }),
      );
      await assert.rejects(() =>
        mutate("notes", { item_id: items[0].id, notes: "stale" }, owner, 1),
      );
    },
  );
  await t.test(
    "move, notes, add day and shortening guards persist",
    async () => {
      await mutate("move", { item_id: items[0].id, day_id: days[2].id });
      await mutate("notes", { item_id: items[0].id, notes: "Bring my camera" });
      assert.equal(
        (
          await asUser(
            db,
            owner,
            `select notes from public.itinerary_items where id='${items[0].id}'`,
          )
        ).rows[0].notes,
        "Bring my camera",
      );
      await assert.rejects(() =>
        mutate("notes", { item_id: items[0].id, notes: "Intrusion" }, other),
      );
      await assert.rejects(() =>
        mutate("update", {
          title: "Shortened",
          notes: "",
          start_date: null,
          end_date: null,
          day_count: 1,
        }),
      );
      await mutate("add_day", {});
      assert.equal(
        (
          await asUser(
            db,
            owner,
            `select end_date::text from public.itineraries where id='${trip}'`,
          )
        ).rows[0].end_date,
        "2026-11-04",
      );
      await mutate("remove", { item_id: items[0].id });
      await mutate("update", {
        title: "Renamed",
        notes: "Trip notes",
        start_date: null,
        end_date: null,
        day_count: 2,
      });
    },
  );
  await t.test(
    "curation requires staff MFA; unpublished and restricted recommendations are hidden",
    async () => {
      const rec = [
        { place_id: river, type: "A day out" },
        { place_id: vip, type: "Premium" },
      ];
      const query = `select public.save_recommendations('${beach}',${sqlJSON(rec)})`;
      await assert.rejects(() => asUser(db, owner, query));
      await assert.rejects(() => asUser(db, admin, query));
      await asUser(db, admin, query, "aal2");
      assert.equal(
        (await asUser(db, other, "select * from public.place_recommendations"))
          .rows.length,
        1,
      );
      await db.exec(
        `update public.places set status='draft' where id='${river}'`,
      );
      assert.equal(
        (await asUser(db, other, "select * from public.place_recommendations"))
          .rows.length,
        0,
      );
      await db.exec(
        `update public.places set status='publish' where id='${river}'`,
      );
      await assert.rejects(() =>
        asUser(
          db,
          admin,
          `select public.save_recommendations('${beach}',${sqlJSON([{ place_id: beach }])})`,
          "aal2",
        ),
      );
      assert.equal(
        (
          await asUser(
            db,
            admin,
            "select * from public.place_recommendations",
            "aal2",
          )
        ).rows.length,
        2,
        "failed replacement rolled back",
      );
    },
  );
  await t.test(
    "new transport fields default to unknown and reject invalid durations",
    async () => {
      const row = (
        await asUser(
          db,
          owner,
          `select hike_minutes,boat_minutes,road_minutes,boat_required from public.place_details where place_id='${beach}'`,
        )
      ).rows[0];
      assert.deepEqual(row, {
        hike_minutes: null,
        boat_minutes: null,
        road_minutes: null,
        boat_required: false,
      });
      await assert.rejects(() =>
        db.exec(
          `update public.place_details set transport_minutes='{"Car":-5}' where place_id='${beach}'`,
        ),
      );
      await assert.rejects(() =>
        db.exec(
          `update public.place_details set transport_minutes='{"Hike":20}' where place_id='${beach}'`,
        ),
      );
    },
  );
  await t.test("deletion cascades only the owner plan", async () => {
    await mutate("delete", {});
    assert.equal(
      (await asUser(db, owner, "select * from public.itinerary_days")).rows
        .length,
      0,
    );
    assert.equal(
      (await asUser(db, owner, "select * from public.itinerary_items")).rows
        .length,
      0,
    );
  });
});
