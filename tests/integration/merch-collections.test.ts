import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMerchCollections } from "../../src/lib/merch-collections";
import { products } from "../../src/lib/merch-products";
test("merch collections have distinct names, default first and no repeated products", () => {
  const original = {
    ...products[0],
    brand: "Unlock Paradise",
    brandId: "brand-up",
    collectionId: "collection-up",
    collection: "Unlock Paradise Collection",
  };
  const future = {
    ...products[1],
    brand: "Another Brand",
    brandId: "brand-other",
    collectionId: "collection-other",
    collection: "Coastal Essentials",
  };
  const sameNameDifferentBrand = {
    ...products[2],
    brand: "Third Brand",
    brandId: "third",
    collectionId: "third-collection",
    collection: "Coastal Essentials",
  };
  const sections = groupMerchCollections([
    future,
    original,
    sameNameDifferentBrand,
  ]);
  assert.equal(sections[0].name, "Unlock Paradise Collection");
  assert.equal(sections.length, 3);
  assert.equal(
    sections.reduce((total, s) => total + s.products.length, 0),
    3,
  );
  assert.deepEqual(groupMerchCollections([]), []);
  assert.equal(groupMerchCollections([future])[0].name, "Coastal Essentials");
  assert.equal(
    groupMerchCollections([
      {
        ...products[0],
        brand: undefined,
        collection: undefined,
        collectionId: undefined,
      },
    ])[0].name,
    "Unlock Paradise Collection",
  );
});
