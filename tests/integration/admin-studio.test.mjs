import { test } from "node:test";
import assert from "node:assert/strict";
import { database, asUser } from "./database.mjs";
const owner = "00000000-0000-4000-8000-000000000301",
  editor = "00000000-0000-4000-8000-000000000302",
  manager = "00000000-0000-4000-8000-000000000303",
  explorer = "00000000-0000-4000-8000-000000000304",
  premium = "00000000-0000-4000-8000-000000000305";
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const hash = "a".repeat(64);
test("Phase 3 studio, commerce and analytics enforce domain boundaries", async (t) => {
  const db = await database();
  t.after(() => db.close());
  await db.exec(
    `insert into auth.users(id) values('${owner}'),('${editor}'),('${manager}'),('${explorer}'),('${premium}');insert into public.user_roles(user_id,role) values('${owner}','admin'),('${editor}','editor'),('${manager}','order_manager');insert into public.entitlements(user_id,source,reason) values('${premium}','manual','Synthetic test');`,
  );
  const body = {
    name: "Studio test product",
    slug: "studio-test-product",
    sku: "STUDIO-TEST",
    description: "Synthetic test only",
    category: "Tees",
    price_centavos: 12345,
    compare_at_centavos: null,
    status: "draft",
    featured: false,
    images: [{ src: "/merch/images/tee1-display.png", alt: "Synthetic test" }],
    content: {},
    variants: [
      {
        sku: "STUDIO-TEST-M",
        label: "M / Navy",
        price_centavos: 12345,
        stock: 5,
        active: true,
      },
    ],
  };
  let product, variant, order;
  await t.test(
    "public viewer access stays callable and never grants anonymous privileges",
    async () => {
      const access = (
        await asUser(
          db,
          null,
          "select public.viewer_access() access",
          "aal1",
          "anon",
        )
      ).rows[0].access;
      assert.equal(access.admin, false);
      assert.equal(access.staff, false);
      assert.equal(access.orders, false);
    },
  );
  const save = (actor, b = body, pid = product, version = 1, aal = "aal2") =>
    asUser(
      db,
      actor,
      `select public.admin_save_product(${pid || "null"},${version},${json(b)}) id`,
      aal,
    );
  await t.test(
    "anon, Explorer, Explorer+, editor, order manager and missing MFA cannot mutate catalog",
    async () => {
      await assert.rejects(() =>
        asUser(
          db,
          null,
          `select public.admin_save_product(null,null,${json(body)})`,
          "aal1",
          "anon",
        ),
      );
      for (const actor of [explorer, premium, editor, manager])
        await assert.rejects(() => save(actor));
      await assert.rejects(() => save(owner, body, null, 1, "aal1"));
      await db.exec(
        `update auth.users set raw_user_meta_data='{"role":"admin","aal":"aal2"}' where id='${explorer}'`,
      );
      await assert.rejects(() => save(explorer));
    },
  );
  await t.test(
    "owner creates draft and variants atomically; public sees only published catalog",
    async () => {
      product = (await save(owner, body, null)).rows[0].id;
      variant = (
        await db.query(
          `select id from public.merch_variants where product_id=${product}`,
        )
      ).rows[0].id;
      assert.equal(
        (
          await asUser(
            db,
            null,
            `select id from public.merch_products where id=${product}`,
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
            null,
            `select id from public.merch_variants where product_id=${product}`,
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
            `select id from public.merch_products where id=${product}`,
            "aal1",
          )
        ).rows.length,
        0,
      );
      body.variants[0].id = variant;
      body.status = "publish";
      await save(owner);
      assert.equal(
        (
          await asUser(
            db,
            null,
            `select price_centavos from public.merch_products where id=${product}`,
            "aal1",
            "anon",
          )
        ).rows[0].price_centavos,
        12345,
      );
    },
  );
  await t.test(
    "direct table writes, negative stock, duplicate SKU, invalid image and stale saves fail without partial writes",
    async () => {
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `update public.merch_products set price_centavos=1 where id=${product}`,
          "aal2",
        ),
      );
      const invalids = [
        { ...body, variants: [{ ...body.variants[0], stock: -1 }] },
        { ...body, price_centavos: -1 },
        {
          ...body,
          images: [{ src: "/merch/images/../../secret.png", alt: "" }],
        },
        {
          ...body,
          variants: [
            body.variants[0],
            { ...body.variants[0], id: undefined, label: "Other" },
          ],
        },
      ];
      for (const bad of invalids)
        await assert.rejects(() => save(owner, bad, product, 2));
      await assert.rejects(
        () => save(owner, body, product, 1),
        (e) => e.code === "PT409",
      );
      const p = (
        await db.query(
          `select version,price_centavos from public.merch_products where id=${product}`,
        )
      ).rows[0];
      assert.equal(p.version, 2);
      assert.equal(p.price_centavos, 12345);
    },
  );
  await t.test(
    "a variant cannot be reassigned from another product",
    async () => {
      const foreign = (
        await db.query(
          "select id from public.merch_variants where product_id=1 limit 1",
        )
      ).rows[0].id;
      await assert.rejects(() =>
        save(
          owner,
          { ...body, variants: [{ ...body.variants[0], id: foreign }] },
          product,
          2,
        ),
      );
      assert.equal(
        (
          await db.query(
            `select version from public.merch_products where id=${product}`,
          )
        ).rows[0].version,
        2,
      );
    },
  );
  const requestKey = "20000000-0000-4000-8000-000000000301";
  const prepare = () =>
    asUser(
      db,
      null,
      `select public.prepare_merch_order('${explorer}','${requestKey}',${json([{ variant_id: variant, quantity: 2, price_centavos: 1 }])}) id`,
      "aal1",
      "service_role",
    );
  await t.test(
    "trusted order preparation calculates integer totals and is idempotent, without decrementing inventory",
    async () => {
      for (const actor of [owner, editor, manager, explorer, premium])
        await assert.rejects(() =>
          asUser(
            db,
            actor,
            `select public.prepare_merch_order('${explorer}','${requestKey}',${json([{ variant_id: variant, quantity: 2 }])})`,
            "aal2",
          ),
        );
      order = (await prepare()).rows[0].id;
      assert.equal((await prepare()).rows[0].id, order);
      assert.equal(
        Number(
          (
            await db.query(
              `select total_centavos from public.merch_orders where id='${order}'`,
            )
          ).rows[0].total_centavos,
        ),
        24690,
      );
      assert.equal(
        (
          await db.query(
            `select stock from public.merch_variants where id='${variant}'`,
          )
        ).rows[0].stock,
        5,
      );
      assert.equal(
        (
          await db.query(
            `select count(*)::int n from public.merch_order_items where order_id='${order}'`,
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "unknown inventory is not accepted by future checkout",
    async () => {
      const unknown = (
        await db.query(
          "select id from public.merch_variants where product_id=1 limit 1",
        )
      ).rows[0].id;
      await assert.rejects(() =>
        asUser(
          db,
          null,
          `select public.prepare_merch_order('${explorer}','20000000-0000-4000-8000-000000000302',${json([{ variant_id: unknown, quantity: 1 }])})`,
          "aal1",
          "service_role",
        ),
      );
    },
  );
  await t.test(
    "order RLS separates owners/managers from content editors and member tiers",
    async () => {
      for (const actor of [explorer, premium, editor])
        assert.equal(
          (
            await asUser(
              db,
              actor,
              "select id from public.merch_orders",
              "aal2",
            )
          ).rows.length,
          0,
        );
      assert.equal(
        (await asUser(db, owner, "select id from public.merch_orders", "aal1"))
          .rows.length,
        0,
      );
      for (const actor of [owner, manager])
        assert.equal(
          (
            await asUser(
              db,
              actor,
              "select id from public.merch_orders",
              "aal2",
            )
          ).rows.length,
          1,
        );
      await assert.rejects(() =>
        asUser(
          db,
          manager,
          `update public.merch_orders set payment_status='paid' where id='${order}'`,
          "aal2",
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          manager,
          `select public.admin_fulfill_order('${order}',1,'processing','')`,
          "aal2",
        ),
      );
    },
  );
  const confirm = (amount, event = "evt-studio-paid", refund = null) =>
    asUser(
      db,
      null,
      `select public.confirm_merch_payment('${order}','${event}','pay-studio',${amount},'${hash}',${refund ?? "null"}) result`,
      "aal1",
      "service_role",
    );
  await t.test(
    "payment forgery and mismatch fail; confirmed evidence decrements stock exactly once",
    async () => {
      await db.exec(
        `update public.merch_orders set provider_session_id='checkout-studio' where id='${order}'`,
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `select public.confirm_merch_payment('${order}','evt-fake','fake',24690,'${hash}',null)`,
          "aal2",
        ),
      );
      await assert.rejects(() => confirm(1));
      assert.equal((await confirm(24690)).rows[0].result.duplicate, false);
      assert.equal((await confirm(24690)).rows[0].result.duplicate, true);
      assert.equal(
        (
          await db.query(
            `select stock from public.merch_variants where id='${variant}'`,
          )
        ).rows[0].stock,
        3,
      );
      await assert.rejects(
        () => save(owner, body, product, 2),
        (e) => e.code === "PT409",
      );
    },
  );
  await t.test(
    "fulfillment requires designated permission, current version and a forward transition",
    async () => {
      const version = (
        await db.query(
          `select version from public.merch_orders where id='${order}'`,
        )
      ).rows[0].version;
      await assert.rejects(() =>
        asUser(
          db,
          editor,
          `select public.admin_fulfill_order('${order}',${version},'processing','private internal note')`,
          "aal2",
        ),
      );
      await asUser(
        db,
        manager,
        `select public.admin_fulfill_order('${order}',${version},'processing','private internal note')`,
        "aal2",
      );
      await assert.rejects(
        () =>
          asUser(
            db,
            manager,
            `select public.admin_fulfill_order('${order}',${version},'shipped','')`,
            "aal2",
          ),
        (e) => e.code === "PT409",
      );
      await assert.rejects(() =>
        asUser(
          db,
          manager,
          `select public.admin_fulfill_order('${order}',${version + 1},'unfulfilled','')`,
          "aal2",
        ),
      );
      await asUser(
        db,
        owner,
        `select public.admin_fulfill_order('${order}',${version + 1},'shipped','private internal note')`,
        "aal2",
      );
    },
  );
  await t.test(
    "refund reconciliation is monotonic, net sales are accurate, and refunds do not fabricate restocked goods",
    async () => {
      await confirm(24690, "evt-studio-refund", 1000);
      await assert.rejects(() => confirm(24690, "evt-studio-backward", 500));
      const stats = (
        await asUser(
          db,
          manager,
          "select public.admin_sales_summary(current_date-1,current_date+1) stats",
          "aal2",
        )
      ).rows[0].stats;
      assert.equal(Number(stats.net_centavos), 23690);
      assert.equal(stats.paid_orders, 1);
      assert.equal(stats.refunded_orders, 1);
      assert.equal(stats.membership_paid_centavos, null);
      await confirm(24690, "evt-studio-full-refund", 24690);
      assert.equal(
        (
          await db.query(
            `select stock from public.merch_variants where id='${variant}'`,
          )
        ).rows[0].stock,
        3,
      );
    },
  );
  const place = "10000000-0000-4000-8000-000000000301",
    session = "30000000-0000-4000-8000-000000000301";
  await t.test(
    "consented view deduplication and analytics aggregation preserve event/session distinction",
    async () => {
      await db.exec(
        `insert into public.places(id,slug,title,status) values('${place}','studio-analytics-test','Studio analytics test','publish');insert into public.analytics_events(event_id,session_id,name,place_id,day,at) values('40000000-0000-4000-8000-000000000301','${session}','place_viewed','${place}','2026-10-19','2026-10-19T00:00:00Z'),('40000000-0000-4000-8000-000000000302','${session}','place_saved','${place}','2026-10-19','2026-10-19T01:00:00Z');`,
      );
      await assert.rejects(() =>
        db.exec(
          `insert into public.analytics_events(event_id,session_id,name,place_id,day) values('40000000-0000-4000-8000-000000000303','${session}','place_viewed','${place}','2026-10-19')`,
        ),
      );
      const data = (
        await asUser(
          db,
          owner,
          "select public.admin_analytics('2026-10-19','2026-10-19') stats",
          "aal2",
        )
      ).rows[0].stats;
      assert.equal(data.events, 2);
      assert.equal(data.sessions, 1);
      assert.equal(data.places[0].views, 1);
      assert.equal(data.places[0].saves, 1);
      assert.equal(data.trend.length, 1);
      assert.deepEqual(data.current_saves, []);
      const empty = (
        await asUser(
          db,
          owner,
          "select public.admin_analytics('2026-10-20','2026-10-21') stats",
          "aal2",
        )
      ).rows[0].stats;
      assert.equal(empty.events, 0);
      assert.equal(empty.trend.length, 2);
    },
  );
  await t.test(
    "area/category interest and ranked metrics use all events in the selected period",
    async () => {
      await db.exec(
        `insert into public.areas(slug,name) values('studio-area','Studio area');insert into public.categories(slug,name) values('studio-category','Studio category');insert into public.place_areas(place_id,area_id) select '${place}',id from public.areas where slug='studio-area';insert into public.place_categories(place_id,category_id) select '${place}',id from public.categories where slug='studio-category';`,
      );
      const data = (
        await asUser(
          db,
          owner,
          "select public.admin_analytics('2026-10-19','2026-10-19') data",
          "aal2",
        )
      ).rows[0].data;
      assert.equal(data.areas[0].views, 1);
      assert.equal(data.categories[0].views, 1);
      const saved = (
        await asUser(
          db,
          owner,
          "select public.admin_ranked_interest('2026-10-19','2026-10-19','saves') data",
          "aal2",
        )
      ).rows[0].data;
      assert.equal(saved[0].id, place);
      assert.equal(saved[0].saves, 1);
      assert.deepEqual(
        (
          await asUser(
            db,
            owner,
            "select public.admin_ranked_interest('2026-10-19','2026-10-19','planned') data",
            "aal2",
          )
        ).rows[0].data,
        [],
      );
      await assert.rejects(() =>
        asUser(
          db,
          editor,
          "select public.admin_ranked_interest('2026-10-19','2026-10-19','views')",
          "aal2",
        ),
      );
    },
  );
  await t.test(
    "analytics rejects unauthorized access, direct event insertion and excessive date ranges",
    async () => {
      for (const actor of [editor, manager, explorer, premium])
        await assert.rejects(() =>
          asUser(
            db,
            actor,
            "select public.admin_analytics('2026-10-19','2026-10-19')",
            "aal2",
          ),
        );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          "select public.admin_analytics('2026-01-01','2026-10-19')",
          "aal2",
        ),
      );
      await assert.rejects(() =>
        asUser(
          db,
          owner,
          `insert into public.analytics_events(event_id,session_id,name) values(gen_random_uuid(),'${session}','order_paid')`,
          "aal2",
        ),
      );
    },
  );
  await t.test(
    "archived Places with itinerary history cannot be permanently deleted",
    async () => {
      await db.exec(
        `update public.places set status='archived' where id='${place}';insert into public.itineraries(user_id,title) values('${explorer}','Synthetic history');insert into public.itinerary_days(itinerary_id,day_number) select id,1 from public.itineraries where user_id='${explorer}';insert into public.itinerary_items(itinerary_id,day_id,place_id,position) select itinerary_id,id,'${place}',0 from public.itinerary_days;`,
      );
      await assert.rejects(
        () =>
          asUser(
            db,
            owner,
            `select public.admin_delete_place('${place}','studio-analytics-test')`,
            "aal2",
          ),
        (e) => e.code === "23503",
      );
      assert.equal(
        (
          await db.query(
            `select count(*)::int n from public.itinerary_items where place_id='${place}'`,
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "product photos cannot be revoked, deleted or reused after deletion preparation",
    async () => {
      const mid = (
        await db.query(
          "insert into public.media(bucket,object_path,status,alt,mime_type,byte_size) values('destination-public','admin/studio-media-integrity.png','ready','Synthetic product photo','image/png',1) returning id",
        )
      ).rows[0].id;
      const photoBody = {
        ...body,
        name: "Photo lifetime test",
        slug: "photo-lifetime-test",
        sku: "PHOTO-LIFETIME",
        images: [{ src: `/api/media/${mid}/`, alt: "Synthetic photo" }],
        variants: [
          {
            sku: "PHOTO-LIFETIME-OS",
            label: "One Size",
            price_centavos: 100,
            stock: 1,
            active: true,
          },
        ],
      };
      const pid = (await save(owner, photoBody, null)).rows[0].id;
      await assert.rejects(
        () =>
          asUser(
            db,
            owner,
            `select public.admin_prepare_media_delete('${mid}')`,
            "aal2",
          ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        () =>
          db.exec(
            `update public.media set status='rejected' where id='${mid}'`,
          ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        () => db.exec(`delete from public.media where id='${mid}'`),
        (e) => e.code === "23503",
      );
      assert.equal(
        (await db.query(`select status from public.media where id='${mid}'`))
          .rows[0].status,
        "ready",
      );
      const vid = (
        await db.query(
          `select id from public.merch_variants where product_id=${pid}`,
        )
      ).rows[0].id;
      await save(
        owner,
        {
          ...photoBody,
          images: body.images,
          variants: [{ ...photoBody.variants[0], id: vid }],
        },
        pid,
        1,
      );
      await asUser(
        db,
        owner,
        `select public.admin_prepare_media_delete('${mid}')`,
        "aal2",
      );
      await assert.rejects(
        () =>
          save(
            owner,
            {
              ...photoBody,
              slug: "photo-after-revocation",
              sku: "PHOTO-AFTER",
              variants: [{ ...photoBody.variants[0], sku: "PHOTO-AFTER-OS" }],
            },
            null,
          ),
        (e) => e.code === "23514",
      );
      await db.exec(`delete from public.media where id='${mid}'`);
    },
  );
  await t.test(
    "safe audit summaries contain meaningful changes and exclude private notes or payment payloads",
    async () => {
      const logs = (
        await db.query(
          "select summary from public.audit_logs where table_name in ('merch_orders','merch_products','merch_variants')",
        )
      ).rows;
      assert.ok(logs.some((r) => JSON.stringify(r.summary).includes("stock")));
      assert.ok(
        logs.some((r) => JSON.stringify(r.summary).includes("price_centavos")),
      );
      assert.ok(!JSON.stringify(logs).includes("private internal note"));
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity",
          )
        ).rows[0].n,
        0,
      );
    },
  );
});
