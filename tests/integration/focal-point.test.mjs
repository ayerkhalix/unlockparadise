import { test } from "node:test";
import assert from "node:assert/strict";
import {
  focalCoverRegion,
  sourceFocalPoint,
  stripFocalPoint,
  withFocalPoint,
  focalPointInput,
} from "../../src/lib/focal-point.ts";
import { responsiveImage } from "../../src/lib/image-delivery.ts";
import { database, asUser } from "./database.mjs";
const json = (v) => `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;
test("focal points cannot inject CSS or change private media routing and crops remain in image bounds", () => {
  const source =
    "/api/media/10000000-0000-4000-8000-000000000681/?variant=medium_large";
  const focused = withFocalPoint(source, { x: 75, y: 20 });
  assert.deepEqual(sourceFocalPoint(focused), { x: 75, y: 20 });
  assert.equal(stripFocalPoint(focused), source);
  assert.ok(responsiveImage(focused).src.startsWith("/api/media/"));
  assert.ok(!responsiveImage(focused).src.includes("focus_"));
  assert.equal(
    sourceFocalPoint(source + "&focus_x=url(evil)&focus_y=5"),
    undefined,
  );
  assert.equal(focalPointInput.safeParse({ x: 101, y: 0 }).success, false);
  assert.deepEqual(focalCoverRegion(1600, 900, { x: 25, y: 50 }), {
    left: 100,
    top: 0,
    width: 1200,
    height: 900,
  });
  for (const [width, height] of [
    [1, 1],
    [1080, 1920],
    [4032, 3024],
  ])
    for (const v of [0, 50, 100]) {
      const crop = focalCoverRegion(width, height, { x: v, y: v });
      assert.ok(
        crop.left >= 0 && crop.top >= 0 && crop.width > 0 && crop.height > 0,
      );
      assert.ok(
        crop.left + crop.width <= width && crop.top + crop.height <= height,
      );
    }
});
test("photo crop saves are staff protected, transactional and preserve existing focal points for older clients", async (t) => {
  const db = await database();
  t.after(() => db.close());
  const admin = "00000000-0000-4000-8000-000000000691",
    free = "00000000-0000-4000-8000-000000000692",
    mid = "30000000-0000-4000-8000-000000000691";
  await db.exec(
    `insert into auth.users(id) values('${admin}'),('${free}');insert into public.user_roles(user_id,role) values('${admin}','admin');insert into public.media(id,bucket,object_path,mime_type,byte_size,status) values('${mid}','destination-public','synthetic/focal.webp','image/webp',100,'ready');`,
  );
  const body = {
    title: "Synthetic crop",
    slug: "synthetic-crop",
    status: "publish",
    vip_content: false,
    premium_content: false,
    listing_types: ["destination"],
    travel_minutes: 30,
    accessibility: ["Car"],
    assets: [],
    featured: false,
    feature_order: 0,
    description: "",
    content: "",
    excerpt: "",
    latitude: 10,
    longitude: 118,
    weekday_crowd: "",
    weekend_crowd: "",
    area_ids: [],
    category_ids: [],
    cover_id: mid,
    gallery: [mid],
    focal_points: { [mid]: { x: 75, y: 20 } },
  };
  const call = (id, payload, user = admin, aal = "aal2") =>
    asUser(
      db,
      user,
      `select public.admin_save_place(${id ? `'${id}'` : "null"},${json(payload)}) id`,
      aal,
    );
  await assert.rejects(() => call(null, body, free));
  await assert.rejects(() => call(null, body, admin, "aal1"));
  const id = (await call(null, body)).rows[0].id;
  const points = () =>
    db.query(
      `select focal_x::float x,focal_y::float y from public.place_media where place_id='${id}'`,
    );
  assert.ok((await points()).rows.every((p) => p.x === 75 && p.y === 20));
  const stamp = (
    await db.query(
      `select updated_at::text stamp from public.places where id='${id}'`,
    )
  ).rows[0].stamp;
  const legacy = { ...body, expected_updated_at: stamp };
  delete legacy.focal_points;
  await call(id, legacy);
  assert.ok((await points()).rows.every((p) => p.x === 75 && p.y === 20));
  const nextStamp = (
    await db.query(
      `select updated_at::text stamp from public.places where id='${id}'`,
    )
  ).rows[0].stamp;
  await assert.rejects(() =>
    call(id, {
      ...body,
      title: "Must roll back",
      expected_updated_at: nextStamp,
      focal_points: { [mid]: { x: -1, y: 0 } },
    }),
  );
  assert.equal(
    (await db.query(`select title from public.places where id='${id}'`)).rows[0]
      .title,
    "Synthetic crop",
  );
  assert.ok((await points()).rows.every((p) => p.x === 75 && p.y === 20));
  const publicRow = (
    await asUser(
      db,
      null,
      "select public.browse_places(null,null,null,false,100,0) value",
      "aal1",
      "anon",
    )
  ).rows.find((row) => row.value.id === id).value;
  assert.ok(publicRow.place_media.every((p) => Number(p.focal_x) === 75));
  await assert.rejects(
    () =>
      asUser(
        db,
        admin,
        `select private.admin_save_place_before_focal('${id}',${json(body)})`,
        "aal2",
      ),
    /permission denied/,
  );
  for (const focal of [
    { x: 80, y: 10 },
    { x: 101, y: 0 },
    { x: 1, y: 2, extra: true },
  ]) {
    const valid = (
      await db.query(
        `select private.valid_product_images(${json([{ src: "/merch/images/tee1-display.png", alt: "Photo", focal }])}) valid`,
      )
    ).rows[0].valid;
    assert.equal(valid, focal.x === 80);
  }
  const product = {
    name: "Synthetic focal product",
    slug: "synthetic-focal-product",
    sku: "FOCAL-TEST",
    description: "Synthetic test only",
    category: "Tees",
    price_centavos: 10000,
    compare_at_centavos: null,
    status: "draft",
    featured: false,
    images: [
      {
        src: "/merch/images/tee1-display.png",
        alt: "Synthetic photo",
        focal: { x: 80, y: 10 },
      },
    ],
    content: {},
    variants: [
      {
        sku: "FOCAL-M",
        label: "M",
        price_centavos: 10000,
        stock: 5,
        active: true,
      },
    ],
  };
  const productId = (
    await asUser(
      db,
      admin,
      `select public.admin_save_product(null,null,${json(product)}) id`,
      "aal2",
    )
  ).rows[0].id;
  const savedProduct = () =>
    db.query(
      `select images,version from public.merch_products where id=${productId}`,
    );
  assert.deepEqual((await savedProduct()).rows[0].images[0].focal, {
    x: 80,
    y: 10,
  });
  await assert.rejects(() =>
    asUser(
      db,
      admin,
      `select public.admin_save_product(${productId},1,${json({ ...product, images: [{ ...product.images[0], focal: { x: 101, y: 10 } }] })})`,
      "aal2",
    ),
  );
  assert.deepEqual((await savedProduct()).rows[0].images[0].focal, {
    x: 80,
    y: 10,
  });
  assert.equal((await savedProduct()).rows[0].version, 1);
});
