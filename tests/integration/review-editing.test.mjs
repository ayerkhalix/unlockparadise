import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";

test("review edits retain ownership, membership gates, creation date and moderation", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const owner = "00000000-0000-4000-8000-000000000891",
    other = "00000000-0000-4000-8000-000000000892",
    place = "10000000-0000-4000-8000-000000000891";
  await db.exec(
    `insert into auth.users(id) values('${owner}'),('${other}');insert into public.places(id,title,slug,status) values('${place}','Review editing','review-editing','publish');insert into public.place_details(place_id) values('${place}');`,
  );
  const inserted = (
    await asUser(
      db,
      owner,
      `insert into public.reviews(place_id,user_id,author_name,rating,title,body) values('${place}','${owner}','Owner',5,'Original','Original body') returning *`,
    )
  ).rows[0];
  const changed = (
    await asUser(
      db,
      owner,
      `update public.reviews set title='Edited',rating=4 where id='${inserted.id}' returning *`,
    )
  ).rows[0];
  assert.ok(changed);
  const after = (
    await db.query(`select * from public.reviews where id='${inserted.id}'`)
  ).rows[0];
  assert.equal(after.title, "Edited");
  assert.equal(after.rating, 4);
  assert.equal(+after.created_at, +inserted.created_at);
  assert.equal(
    (
      await asUser(
        db,
        other,
        `update public.reviews set body='Foreign' where id='${inserted.id}' returning id`,
      )
    ).rows.length,
    0,
  );
  for (const sql of [
    `update public.reviews set status='rejected'`,
    `update public.reviews set user_id='${other}'`,
    `update public.reviews set author_name='Forged name'`,
    `update public.reviews set created_at='2000-01-01T00:00:00Z'`,
  ])
    await assert.rejects(asUser(db, owner, sql));
  await assert.rejects(
    asUser(
      db,
      null,
      `update public.reviews set body='Anonymous'`,
      "aal1",
      "anon",
    ),
  );
  await db.exec(
    `update public.app_settings set value='"hold"' where key='review_moderation';`,
  );
  await asUser(
    db,
    owner,
    `update public.reviews set body='Revised after approval' where id='${inserted.id}'`,
  );
  assert.equal(
    (
      await asUser(
        db,
        owner,
        `select status from public.reviews where id='${inserted.id}'`,
      )
    ).rows[0].status,
    "pending",
  );
  assert.equal(
    (
      await asUser(
        db,
        null,
        `select id from public.reviews where id='${inserted.id}'`,
        "aal1",
        "anon",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await asUser(
        db,
        owner,
        `update public.reviews set title='Stale' where id='${inserted.id}' and updated_at='2000-01-01T00:00:00Z' returning id`,
      )
    ).rows.length,
    0,
  );
  await db.exec(
    `update public.app_settings set value='"vip"' where key='review_write_level';`,
  );
  await assert.rejects(
    asUser(
      db,
      owner,
      `update public.reviews set body='Denied after gate change' where id='${inserted.id}'`,
    ),
  );
});
