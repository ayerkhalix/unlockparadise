import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const free = "00000000-0000-4000-8000-000000001101",
  paid = "00000000-0000-4000-8000-000000001102";
const normal = "10000000-0000-4000-8000-000000001101",
  hidden = "10000000-0000-4000-8000-000000001102",
  draft = "10000000-0000-4000-8000-000000001103";
test("guest/free discovery never exposes premium identities and expired planning stays preserved", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${free}'),('${paid}');
 insert into public.entitlements(user_id,source,reason) values('${paid}','manual','Synthetic privacy test');
 insert into public.places(id,slug,title,status,vip_content,featured) values
 ('${normal}','ordinary-place','Ordinary place','publish',false,true),
 ('${hidden}','secret-gem-name','Secret Gem Name','publish',true,true),
 ('${draft}','secret-draft-name','Secret Draft Name','draft',true,true);
 insert into public.place_details(place_id,latitude,longitude) values('${normal}',10,118),('${hidden}',11,119);
 insert into public.media(id,bucket,object_path,mime_type,byte_size,status,alt) values('20000000-0000-4000-8000-000000001101','destination-public','Secret Gem Name.jpg','image/jpeg',10,'ready','Secret Gem Name');
 insert into public.place_media(place_id,media_id,kind,position) values('${hidden}','20000000-0000-4000-8000-000000001101','cover',0);
 insert into public.reviews(place_id,author_name,rating,body,status) values('${hidden}','Traveler',5,'Secret Gem Name is lovely','approved');`);
  for (const [uid, role] of [
    [null, "anon"],
    [free, "authenticated"],
  ]) {
    assert.equal(
      (
        await asUser(
          db,
          uid,
          `select title,slug from public.places where id='${hidden}'`,
          "aal1",
          role,
        )
      ).rows.length,
      0,
    );
    const preview = (
      await asUser(
        db,
        uid,
        "select public.browse_places() as value",
        "aal1",
        role,
      )
    ).rows.map((r) => r.value);
    const serialized = JSON.stringify(preview);
    assert.ok(!serialized.includes("Secret"));
    assert.ok(!serialized.includes("secret-"));
    assert.equal(preview.find((p) => p.id === hidden).slug, hidden);
    assert.equal(
      preview.find((p) => p.id === hidden).title,
      "Explorer+ destination",
    );
    assert.deepEqual(preview.find((p) => p.id === hidden).place_media, []);
    assert.ok(!preview.some((p) => p.id === draft));
    assert.equal(
      (
        await asUser(
          db,
          uid,
          "select public.browse_places(search_text=>'Secret') as value",
          "aal1",
          role,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await asUser(db, uid, "select * from public.media", "aal1", role)).rows
        .length,
      0,
    );
    assert.equal(
      (
        await asUser(
          db,
          uid,
          `select * from public.reviews where place_id='${hidden}'`,
          "aal1",
          role,
        )
      ).rows.length,
      0,
    );
    const gate = (
      await asUser(
        db,
        uid,
        "select public.locked_place('secret-gem-name') as value",
        "aal1",
        role,
      )
    ).rows[0].value;
    assert.equal(gate.slug, hidden);
    assert.ok(!JSON.stringify(gate).includes("Secret"));
  }
  assert.equal(
    (
      await asUser(
        db,
        paid,
        `select title from public.places where id='${hidden}'`,
      )
    ).rows[0].title,
    "Secret Gem Name",
  );
  const query =
    'select public.plan_itinerary(null,null,\'create\',\'{"title":"Retained trip","day_count":1}\'::jsonb) as id';
  await assert.rejects(() => asUser(db, free, query), /Explorer\+ required/);
  const trip = (await asUser(db, paid, query)).rows[0].id;
  assert.equal(
    (
      await asUser(
        db,
        paid,
        `select * from public.itineraries where id='${trip}'`,
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await asUser(
        db,
        free,
        `select * from public.itinerary_days where itinerary_id='${trip}'`,
      )
    ).rows.length,
    0,
  );
  await db.exec(
    `update public.entitlements set revoked_at=now() where user_id='${paid}'`,
  );
  assert.equal(
    (
      await asUser(
        db,
        paid,
        `select * from public.itineraries where id='${trip}'`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await asUser(
        db,
        paid,
        `select * from public.itinerary_days where itinerary_id='${trip}'`,
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      asUser(
        db,
        paid,
        `select public.plan_itinerary('${trip}',1,'add_day','{}')`,
      ),
    /Explorer\+ required/,
  );
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from public.itineraries where id='${trip}'`,
      )
    ).rows[0].n,
    1,
  );
  await db.exec(
    `update public.entitlements set revoked_at=null where user_id='${paid}'`,
  );
  assert.equal(
    (
      await asUser(
        db,
        paid,
        `select * from public.itineraries where id='${trip}'`,
      )
    ).rows.length,
    1,
  );
});
