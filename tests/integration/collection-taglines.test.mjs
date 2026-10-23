import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";

test("collection taglines are public copy with admin-only updates", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const admin = "00000000-0000-4000-8000-000000000981";
  const explorer = "00000000-0000-4000-8000-000000000982";
  const collection = "00000000-0000-4000-8000-000000000c01";
  await db.exec(
    `insert into auth.users(id) values('${admin}'),('${explorer}'); insert into public.user_roles(user_id,role) values('${admin}','admin')`,
  );
  const read = `select tagline from public.merch_collections where id='${collection}'`;
  assert.equal(
    (await asUser(db, null, read, "aal1", "anon")).rows[0].tagline,
    "Find your way",
  );
  for (const [id, aal] of [
    [explorer, "aal1"],
    [admin, "aal1"],
  ]) {
    const result = await asUser(
      db,
      id,
      `update public.merch_collections set tagline='Unauthorized' where id='${collection}' returning id`,
      aal,
    );
    assert.equal(result.rows.length, 0);
  }
  await assert.rejects(() =>
    asUser(
      db,
      null,
      `update public.merch_collections set tagline='Unauthorized' where id='${collection}'`,
      "aal1",
      "anon",
    ),
  );
  assert.equal(
    (
      await asUser(
        db,
        admin,
        `update public.merch_collections set tagline='Made for the coast' where id='${collection}' returning tagline`,
        "aal2",
      )
    ).rows[0].tagline,
    "Made for the coast",
  );
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      `update public.merch_collections set name='Unauthorized rename' where id='${collection}'`,
      "aal2",
    ),
  );
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      `update public.merch_collections set tagline=repeat('x',161) where id='${collection}'`,
      "aal2",
    ),
  );
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      `update public.merch_collections set tagline=' padded ' where id='${collection}'`,
      "aal2",
    ),
  );
  await asUser(
    db,
    admin,
    `update public.merch_collections set tagline='' where id='${collection}'`,
    "aal2",
  );
  assert.equal(
    (await asUser(db, null, read, "aal1", "anon")).rows[0].tagline,
    "",
  );
});
