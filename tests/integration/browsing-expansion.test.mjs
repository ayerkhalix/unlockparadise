import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const admin = "00000000-0000-4000-8000-000000000801",
  client = "00000000-0000-4000-8000-000000000802",
  explorer = "00000000-0000-4000-8000-000000000803",
  editor = "00000000-0000-4000-8000-000000000804";
const brand = "00000000-0000-4000-8000-000000000b01",
  collection = "00000000-0000-4000-8000-000000000c01";
const iss = "https://namkxlsdjnopixhzrvyl.supabase.co/auth/v1";
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
async function claim(db, id, claims, sql) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims',${json({ sub: id, role: "authenticated", aal: "aal1", iss, app_metadata: { staging_client_review: true }, ...claims })}::text,false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
test("Client access and browsing expansion preserve authorization and saved data", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(
    `insert into auth.users(id) values('${admin}'),('${client}'),('${explorer}'),('${editor}');insert into public.user_roles(user_id,role) values('${admin}','admin'),('${client}','admin'),('${editor}','editor');insert into private.staging_admin_mfa_exemptions(user_id,reason) values('${client}','Owner-authorized client review');`,
  );
  await t.test(
    "only the allowed staging admin gets password-only access",
    async () => {
      assert.equal(
        (await claim(db, client, {}, "select public.viewer_access() a")).rows[0]
          .a.admin,
        true,
      );
      assert.equal(
        (
          await claim(
            db,
            client,
            { app_metadata: {} },
            "select public.viewer_access() a",
          )
        ).rows[0].a.admin,
        false,
      );
      for (const id of [admin, explorer, editor])
        assert.equal(
          (
            await claim(
              db,
              id,
              { user_metadata: { admin: true, mfa_exempt: true } },
              "select public.viewer_access() a",
            )
          ).rows[0].a.admin,
          false,
        );
      assert.equal(
        (
          await claim(
            db,
            client,
            { iss: "https://production.example/auth/v1" },
            "select public.viewer_access() a",
          )
        ).rows[0].a.admin,
        false,
      );
      assert.equal(
        (await asUser(db, admin, "select public.viewer_access() a", "aal2"))
          .rows[0].a.admin,
        true,
      );
    },
  );
  await t.test(
    "exception cannot be read or self-granted and revocation is immediate",
    async () => {
      for (const id of [client, admin, explorer])
        await assert.rejects(() =>
          claim(
            db,
            id,
            {},
            "select * from private.staging_admin_mfa_exemptions",
          ),
        );
      await assert.rejects(() =>
        claim(
          db,
          explorer,
          {},
          `insert into private.staging_admin_mfa_exemptions(user_id,reason) values('${explorer}','spoof')`,
        ),
      );
      await db.exec(
        `update private.staging_admin_mfa_exemptions set enabled=false where user_id='${client}'`,
      );
      assert.equal(
        (await claim(db, client, {}, "select public.viewer_access() a")).rows[0]
          .a.admin,
        false,
      );
      await db.exec(
        `update private.staging_admin_mfa_exemptions set enabled=true where user_id='${client}';delete from public.user_roles where user_id='${client}';`,
      );
      assert.equal(
        (await claim(db, client, {}, "select public.viewer_access() a")).rows[0]
          .a.admin,
        false,
      );
      await db.exec(
        `insert into public.user_roles(user_id,role) values('${client}','admin')`,
      );
    },
  );
  let otherBrand, otherCollection;
  await t.test(
    "brands and collections are readable but only admins can add options",
    async () => {
      assert.ok(
        (
          await asUser(
            db,
            null,
            "select * from public.merch_brands",
            "aal1",
            "anon",
          )
        ).rows.length,
      );
      await assert.rejects(() =>
        claim(
          db,
          explorer,
          {},
          "insert into public.merch_brands(name,slug) values('Spoof','spoof')",
        ),
      );
      await assert.rejects(() =>
        claim(
          db,
          admin,
          {},
          "insert into public.merch_options(kind,name) values('color','Spoof')",
        ),
      );
      otherBrand = (
        await claim(
          db,
          client,
          {},
          "insert into public.merch_brands(name,slug) values('Other Brand','other-brand') returning id",
        )
      ).rows[0].id;
      otherCollection = (
        await claim(
          db,
          client,
          {},
          `insert into public.merch_collections(brand_id,name,slug) values('${otherBrand}','Other Collection','other-collection') returning id`,
        )
      ).rows[0].id;
    },
  );
  const body = {
    name: "Synthetic expansion product",
    slug: "expansion-test",
    sku: "EXPANSION-TEST",
    description: "Test",
    category: "Tees",
    price_centavos: 12000,
    compare_at_centavos: null,
    status: "draft",
    featured: false,
    images: [{ src: "/merch/images/tee1-display.png", alt: "Test" }],
    content: { color: "Navy" },
    variants: [
      {
        sku: "EXPANSION-TEST-M",
        label: "M",
        price_centavos: 12000,
        stock: 2,
        active: true,
      },
    ],
    brand_id: brand,
    collection_id: collection,
  };
  let pid;
  await t.test(
    "collection ownership is transactional and stale versions still fail",
    async () => {
      await assert.rejects(() =>
        claim(
          db,
          client,
          {},
          `select public.admin_save_product(null,null,${json({ ...body, collection_id: otherCollection })})`,
        ),
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.merch_products where sku='EXPANSION-TEST'",
          )
        ).rows[0].n,
        0,
      );
      pid = (
        await claim(
          db,
          client,
          {},
          `select public.admin_save_product(null,null,${json({ ...body, brand_id: otherBrand, collection_id: otherCollection })}) id`,
        )
      ).rows[0].id;
      body.variants[0].id = (
        await db.query(
          `select id from public.merch_variants where product_id=${pid}`,
        )
      ).rows[0].id;
      await claim(
        db,
        client,
        {},
        `select public.admin_save_product(${pid},1,${json({ ...body, brand_id: otherBrand, collection_id: otherCollection })})`,
      );
      await assert.rejects(() =>
        claim(
          db,
          client,
          {},
          `select public.admin_save_product(${pid},1,${json(body)})`,
        ),
      );
      assert.equal(
        (
          await db.query(
            `select collection_id from public.merch_products where id=${pid}`,
          )
        ).rows[0].collection_id,
        otherCollection,
      );
    },
  );
  const point = {
    name: "Test dock",
    type: "Boat departure",
    latitude: 10.1,
    longitude: 119.2,
    directions: "Synthetic directions",
  };
  let place;
  await t.test(
    "access points validate coordinates and remain behind Place RLS",
    async () => {
      place = (
        await db.query(
          "insert into public.places(slug,title,status,vip_content) values('expansion-place','Expansion Place','publish',true) returning id",
        )
      ).rows[0].id;
      await db.exec(
        `insert into public.place_details(place_id,latitude,longitude,access_points) values('${place}',10,119,${json([point, { ...point, name: "Test trail", type: "Trailhead" }])})`,
      );
      assert.equal(
        (
          await asUser(
            db,
            explorer,
            `select access_points from public.place_details where place_id='${place}'`,
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await asUser(
            db,
            null,
            `select access_points from public.place_details where place_id='${place}'`,
            "aal1",
            "anon",
          )
        ).rows.length,
        0,
      );
      for (const invalid of [
        [{ ...point, latitude: 91 }],
        [{ ...point, type: "invented" }],
        [{ ...point, longitude: null }],
        Array(13).fill(point),
      ])
        await assert.rejects(() =>
          db.exec(
            `update public.place_details set access_points=${json(invalid)} where place_id='${place}'`,
          ),
        );
      assert.equal(
        (
          await claim(
            db,
            client,
            {},
            `select access_points from public.place_details where place_id='${place}'`,
          )
        ).rows[0].access_points.length,
        2,
      );
    },
  );
  await t.test(
    "dated trips derive days, Add day extends dates, occupied days cannot disappear",
    async () => {
      // Planning requires Explorer+; earlier subtests deliberately use the free
      // account to verify visibility restrictions before this explicit upgrade.
      await db.exec(
        `insert into public.entitlements(user_id,source,reason) values('${explorer}','manual','Date planner test requires Explorer+')`,
      );
      await db.exec("insert into public.areas(id,name,slug) values('20000000-0000-4000-8000-000000000325','Date area','date-area')");
      const trip = (
        await asUser(
          db,
          explorer,
          `select public.plan_itinerary(null,null,'create',${json({ area_id: "20000000-0000-4000-8000-000000000325", title: "Dates", start_date: "2026-10-21", end_date: "2026-10-23", day_count: 1 })}) id`,
        )
      ).rows[0].id;
      assert.equal(
        (
          await db.query(
            `select count(*)::int n from public.itinerary_days where itinerary_id='${trip}'`,
          )
        ).rows[0].n,
        3,
      );
      await asUser(
        db,
        explorer,
        `select public.plan_itinerary('${trip}',1,'add_day','{}')`,
      );
      assert.equal(
        String(
          (
            await db.query(
              `select end_date::text d from public.itineraries where id='${trip}'`,
            )
          ).rows[0].d,
        ),
        "2026-10-24",
      );
      await db.exec(
        `insert into public.itinerary_items(itinerary_id,day_id,place_id,position) select '${trip}',id,'${place}',0 from public.itinerary_days where itinerary_id='${trip}' and day_number=4`,
      );
      await assert.rejects(() =>
        asUser(
          db,
          explorer,
          `select public.plan_itinerary('${trip}',2,'update',${json({ title: "Dates", start_date: "2026-10-21", end_date: "2026-10-22", day_count: 2 })})`,
        ),
      );
      assert.equal(
        (
          await db.query(
            `select count(*)::int n from public.itinerary_items where itinerary_id='${trip}'`,
          )
        ).rows[0].n,
        1,
      );
    },
  );
});
