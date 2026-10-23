import { test } from "node:test";
import assert from "node:assert/strict";
import { productInput } from "../../src/lib/commerce";
import { publicProduct } from "../../src/lib/repositories/commerce";
import { collectionTaglineInput } from "../../src/lib/catalog-options";

const product = {
  name: "Printed tee",
  slug: "printed-tee",
  sku: "TEE-1",
  description: "A comfortable tee.",
  category: "Tees",
  price_centavos: 99900,
  compare_at_centavos: null,
  status: "draft",
  featured: false,
  images: [{ src: "/merch/images/test.jpg", alt: "Printed tee" }],
  variants: [
    {
      sku: "TEE-S",
      label: "S",
      price_centavos: 99900,
      stock: null,
      active: true,
    },
  ],
  content: {
    color: "Navy",
    descriptor: "Front & Back Design",
    details: {
      material: "Cotton",
      fit: "Relaxed",
      weight: "240 GSM",
      care: "Wash cold.",
    },
    highlights: ["Screen printed", "Soft cotton"],
    sizeGuide: [{ size: "S", chest: "20", length: "27", shoulder: "18" }],
  },
};
test("product copy and optional size guide survive the public catalog projection", () => {
  const saved = productInput.parse(product);
  const shown = publicProduct({
    ...saved,
    id: 999,
    merch_variants: saved.variants,
    merch_collections: { name: "Coastal", tagline: "Find your way" },
  });
  assert.equal(shown.descriptor, "Front & Back Design");
  assert.deepEqual(shown.details, saved.content.details);
  assert.deepEqual(shown.highlights, saved.content.highlights);
  assert.deepEqual(shown.sizeGuide, saved.content.sizeGuide);
  assert.equal(shown.collectionTagline, "Find your way");
  assert.ok(
    productInput.safeParse({ ...product, content: { sizeGuide: [] } }).success,
  );
});
test("invalid size rows and oversized product copy are rejected", () => {
  for (const sizeGuide of [
    [{ size: "", chest: "20", length: "27", shoulder: "18" }],
    [...product.content.sizeGuide, ...product.content.sizeGuide],
  ])
    assert.equal(
      productInput.safeParse({ ...product, content: { sizeGuide } }).success,
      false,
    );
  assert.equal(
    productInput.safeParse({
      ...product,
      content: { descriptor: "x".repeat(201) },
    }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({
      ...product,
      content: { highlights: ["x".repeat(301)] },
    }).success,
    false,
  );
  assert.equal(
    collectionTaglineInput.parse(" Find your way "),
    "Find your way",
  );
  assert.equal(
    collectionTaglineInput.safeParse("x".repeat(161)).success,
    false,
  );
  assert.equal(collectionTaglineInput.parse(""), "");
});
