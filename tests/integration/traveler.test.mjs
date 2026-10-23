import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
import {
  answersSchema,
  classifyTraveler,
  emptyAnswers,
  interestKeys,
  interests,
  travelerWriteSchema,
} from "../../src/lib/traveler.ts";
const owner = "00000000-0000-4000-8000-000000000801",
  other = "00000000-0000-4000-8000-000000000802",
  admin = "00000000-0000-4000-8000-000000000803";
const beach = "10000000-0000-4000-8000-000000000801",
  mountain = "10000000-0000-4000-8000-000000000802",
  vip = "10000000-0000-4000-8000-000000000803",
  draft = "10000000-0000-4000-8000-000000000804",
  island = "10000000-0000-4000-8000-000000000805";
const review = "20000000-0000-4000-8000-000000000801";
const sqlJSON = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
test("traveler classification is stable, explainable and validates all fields", () => {
  assert.equal(classifyTraveler(emptyAnswers), "curious-explorer");
  assert.equal(
    classifyTraveler({
      ...emptyAnswers,
      interests: ["beach", "island"],
      pace: "slow",
      style: "scenic",
    }),
    "identity-1",
  );
  assert.equal(
    classifyTraveler({
      ...emptyAnswers,
      interests: ["mountain"],
      pace: "adventure",
      style: "outdoor",
    }),
    "identity-4",
  );
  assert.equal(
    classifyTraveler({ ...emptyAnswers, interests: ["nature"] }),
    "identity-6",
  );
  assert.equal(
    classifyTraveler({ ...emptyAnswers, interests: ["coffee", "food"] }),
    "identity-48",
  );
  assert.equal(
    classifyTraveler({
      ...emptyAnswers,
      interests: ["island"],
      style: "hidden",
    }),
    "identity-1",
  );
  assert.equal(
    classifyTraveler({ ...emptyAnswers, interests: ["beach", "island"] }),
    classifyTraveler({ ...emptyAnswers, interests: ["island", "beach"] }),
  );
  assert.equal(
    classifyTraveler({ ...emptyAnswers, interests: interestKeys.slice(0, 5) }),
    "identity-31",
  );
  for (const invalid of [
    { interests: ["beach", "beach"] },
    { interests: ["admin"] },
    { pace: "safe-for-kids" },
    { public_badges: "true" },
    { premium: true },
  ])
    assert.equal(
      answersSchema.safeParse({ ...emptyAnswers, ...invalid }).success,
      false,
    );
  assert.equal(
    travelerWriteSchema.safeParse({
      op: "complete",
      version: 0,
      answers: emptyAnswers,
      user_id: other,
    }).success,
    false,
  );
  assert.equal(
    travelerWriteSchema.safeParse({
      op: "complete",
      version: -1,
      answers: emptyAnswers,
    }).success,
    false,
  );
});

test("traveler database isolation, live public projection, ranking and SQL/TS parity", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(`insert into auth.users(id) values('${owner}'),('${other}'),('${admin}');insert into public.user_roles(user_id,role) values('${admin}','admin');
  insert into public.categories(slug,name) values('beaches','Beaches'),('islands','Islands'),('mountain-hikes','Mountains'),('rivers','Rivers'),('waterfalls','Waterfalls'),('coffee','Coffee'),('restaurants','Food'),('others','Local Visits');
  insert into public.places(id,slug,title,status,vip_content,featured,feature_order) values
  ('${beach}','test-shore','Test shore','publish',false,true,2),('${mountain}','test-trail','Test trail','publish',false,true,1),('${vip}','test-vip','Premium test','publish',true,true,0),('${draft}','test-draft','Draft','draft',false,true,0),('${island}','test-island','Test island','publish',false,false,0);
  insert into public.place_categories(place_id,category_id) select '${beach}',id from public.categories where slug='beaches';
  insert into public.place_categories(place_id,category_id) select '${mountain}',id from public.categories where slug='mountain-hikes';
  insert into public.place_categories(place_id,category_id) select '${island}',id from public.categories where slug='islands';
  insert into public.place_categories(place_id,category_id) select '${vip}',id from public.categories where slug='beaches';
  insert into public.place_details(place_id,hike_minutes) values('${mountain}',180);
  insert into public.reviews(id,place_id,user_id,author_name,rating,body,status) values('${review}','${beach}','${owner}','Traveler',5,'Synthetic test only','approved');`);
  let version = 0;
  const write = async (
    answers,
    op = "complete",
    expected = version,
    actor = owner,
  ) => {
    const r = await asUser(
      db,
      actor,
      `select * from public.save_traveler_preferences(${sqlJSON({ op, answers })},${expected})`,
    );
    if (actor === owner) version = r.rows[0].version;
    return r.rows[0];
  };
  await t.test(
    "only future profiles are pending, defaults private and own-only reads",
    async () => {
      assert.equal(
        (await asUser(db, owner, "select * from public.traveler_preferences"))
          .rows.length,
        1,
      );
      const row = (
        await asUser(db, owner, "select * from public.traveler_preferences")
      ).rows[0];
      assert.equal(row.status, "pending");
      assert.equal(row.public_badges, false);
      assert.equal(
        (
          await asUser(
            db,
            owner,
            `select * from public.traveler_preferences where user_id='${other}'`,
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() =>
        asUser(
          db,
          null,
          "select * from public.traveler_preferences",
          "aal1",
          "anon",
        ),
      );
    },
  );
  await t.test(
    "invalid/direct duplicate values rejected, owner reassignment and privilege escalation blocked",
    async () => {
      await assert.rejects(() =>
        write({ ...emptyAnswers, interests: ["unknown"] }),
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `update public.traveler_preferences set interests=array['beach','beach'] where user_id='${owner}'`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `update public.traveler_preferences set user_id='${other}' where user_id='${owner}'`,
        ),
      );
      const updated = await asUser(
        db,
        other,
        `update public.traveler_preferences set public_badges=true where user_id='${owner}' returning *`,
      );
      assert.equal(updated.rows.length, 0);
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `insert into public.user_roles(user_id,role) values('${owner}','admin')`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `insert into public.entitlements(user_id,source,reason) values('${owner}','manual','fraud')`,
        ),
      );
    },
  );
  await t.test(
    "transactional save, version conflict and default-private review projection",
    async () => {
      const saved = await write({
        ...emptyAnswers,
        interests: ["beach"],
        pace: "slow",
        style: "scenic",
      });
      assert.equal(saved.archetype, "identity-1");
      assert.equal(saved.version, 1);
      await assert.rejects(() => write(emptyAnswers, "complete", 0));
      assert.equal(
        (
          await asUser(
            db,
            other,
            `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "current opt-in badges contain at most two relevant interests, never private answers",
    async () => {
      await write({
        ...emptyAnswers,
        interests: ["coffee", "beach"],
        pace: "slow",
        companion: "family",
        public_badges: true,
      });
      const result = (
        await asUser(
          db,
          other,
          `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
        )
      ).rows[0];
      assert.deepEqual(Object.keys(result).sort(), [
        "archetype",
        "interests",
        "review_id",
      ]);
      assert.equal(result.interests.length, 1);
      assert.equal(result.interests[0], "beach");
      const next = await write({
        ...emptyAnswers,
        interests: ["mountain"],
        pace: "adventure",
        style: "outdoor",
        public_badges: true,
      });
      assert.equal(next.archetype, "identity-4");
      assert.equal(
        (
          await asUser(
            db,
            other,
            `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
          )
        ).rows[0].archetype,
        "identity-4",
      );
      await write({
        ...emptyAnswers,
        interests: ["mountain"],
        public_badges: false,
      });
      assert.equal(
        (
          await asUser(
            db,
            other,
            `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "public badge projection obeys review moderation and guest Place access",
    async () => {
      await write({
        ...emptyAnswers,
        interests: ["beach"],
        public_badges: true,
      });
      assert.equal(
        (
          await asUser(
            db,
            null,
            `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
            "aal1",
            "anon",
          )
        ).rows.length,
        0,
      );
      await db.exec(
        `update public.app_settings set value='"public"' where key='place_gate'`,
      );
      assert.equal(
        (
          await asUser(
            db,
            null,
            `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
            "aal1",
            "anon",
          )
        ).rows.length,
        1,
      );
      await db.exec(
        `update public.reviews set status='pending' where id='${review}'`,
      );
      assert.equal(
        (
          await asUser(
            db,
            other,
            `select * from public.public_traveler_badges(array['${review}']::uuid[])`,
          )
        ).rows.length,
        0,
      );
      await db.exec(
        `update public.reviews set status='approved' where id='${review}'`,
      );
    },
  );
  await t.test(
    "ranking follows interests, includes variety and never leaks VIP or draft rows",
    async () => {
      for (let i = 1; i <= 3; i++) {
        const extra = `10000000-0000-4000-8000-00000000081${i}`;
        await db.exec(
          `insert into public.places(id,slug,title,status) values('${extra}','extra-mountain-${i}','Extra mountain ${i}','publish');insert into public.place_categories(place_id,category_id) select '${extra}',id from public.categories where slug='mountain-hikes';`,
        );
      }
      await write({
        ...emptyAnswers,
        interests: ["beach"],
        pace: "slow",
      });
      let rows = (
        await asUser(db, owner, "select * from public.traveler_featured(4)")
      ).rows;
      assert.ok([beach, island].includes(rows[0].id));
      assert.ok(rows.some((p) => p.id === island));
      assert.ok(!rows.some((p) => [vip, draft].includes(p.id)));
      await write({
        ...emptyAnswers,
        interests: ["mountain"],
        pace: "adventure",
      });
      rows = (
        await asUser(db, owner, "select * from public.traveler_featured(4)")
      ).rows;
      assert.equal(rows[0].id, mountain);
      assert.ok(
        rows.some((row) => row.id === beach),
        "A single-interest four-card selection retains editorial variety.",
      );
      await db.exec(
        `insert into public.entitlements(user_id,source,reason) values('${owner}','manual','Synthetic traveler test')`,
      );
      rows = (
        await asUser(db, owner, "select * from public.traveler_featured(12)")
      ).rows;
      assert.ok(rows.some((p) => p.id === vip));
      assert.ok(!rows.some((p) => p.id === draft));
      await write(emptyAnswers);
      assert.equal(
        (await asUser(db, owner, "select * from public.traveler_featured(4)"))
          .rows.length,
        0,
      );
      await assert.rejects(() =>
        asUser(
          db,
          null,
          "select * from public.traveler_featured(4)",
          "aal1",
          "anon",
        ),
      );
    },
  );
  await t.test(
    "all mapped interests use existing categories and classifier SQL matches client permutations",
    async () => {
      const categories = (
        await db.query("select slug from public.categories")
      ).rows.map((r) => r.slug);
      assert.ok(
        interests.every((i) =>
          i.categories.every((c) => categories.includes(c)),
        ),
      );
      const cases = [];
      for (let mask = 0; mask < 512; mask++) {
        const keys = interestKeys.filter((_, i) => mask & (1 << i));
        const pace = [null, "slow", "balanced", "adventure"][mask % 4],
          style = [null, "hidden", "scenic", "outdoor", "food", "everything"][
            mask % 6
          ];
        cases.push({ keys, pace, style });
      }
      const quote = (v) => (v === null ? "null" : `'${v}'`);
      const query =
        "select private.traveler_archetype(keys,pace,style) archetype from (values " +
        cases
          .map(
            (c) =>
              `(array[${c.keys.map(quote).join(",")}]::text[],${quote(c.pace)},${quote(c.style)})`,
          )
          .join(",") +
        ") v(keys,pace,style)";
      const rows = (await db.query(query)).rows;
      rows.forEach((r, i) =>
        assert.equal(
          r.archetype,
          classifyTraveler({
            interests: cases[i].keys,
            pace: cases[i].pace,
            style: cases[i].style,
          }),
        ),
      );
    },
  );
  await t.test(
    "skipping/dismissing are persistent, clear removes public sharing, admin aggregates require MFA",
    async () => {
      await write(emptyAnswers, "clear");
      assert.equal(
        (await asUser(db, owner, "select * from public.traveler_preferences"))
          .rows[0].status,
        "skipped",
      );
      await write(emptyAnswers, "dismiss");
      assert.equal(
        (await asUser(db, owner, "select * from public.traveler_preferences"))
          .rows[0].status,
        "dismissed",
      );
      await assert.rejects(() =>
        asUser(db, owner, "select public.traveler_discovery_stats()"),
      );
      await assert.rejects(() =>
        asUser(db, admin, "select public.traveler_discovery_stats()"),
      );
      const stats = (
        await asUser(
          db,
          admin,
          "select public.traveler_discovery_stats() s",
          "aal2",
        )
      ).rows[0].s;
      assert.deepEqual(stats, { available: false, minimum: 10 });
      assert.equal(
        (
          await asUser(
            db,
            admin,
            "select * from public.traveler_preferences",
            "aal2",
          )
        ).rows.length,
        1,
      );
    },
  );
  await t.test(
    "aggregate insights require ten completed travelers and suppress groups under five",
    async () => {
      for (let n = 0; n < 10; n++) {
        const id = `00000000-0000-4000-8000-${String(900 + n).padStart(12, "0")}`;
        const key = n < 5 ? "beach" : n < 8 ? "coffee" : "mountain";
        await db.exec(
          `insert into auth.users(id) values('${id}');update public.traveler_preferences set status='completed',interests=array['${key}'] where user_id='${id}';`,
        );
      }
      const stats = (
        await asUser(
          db,
          admin,
          "select public.traveler_discovery_stats() s",
          "aal2",
        )
      ).rows[0].s;
      assert.equal(stats.available, true);
      assert.equal(stats.completed, 10);
      assert.deepEqual(stats.interests, [{ key: "beach", count: 5 }]);
      assert.deepEqual(stats.archetypes, [
        { key: "identity-1", count: 5 },
      ]);
      assert.ok(!JSON.stringify(stats).includes(owner));
    },
  );
});
