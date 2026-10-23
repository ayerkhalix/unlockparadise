import type { Product } from "./merch-products";
export function groupMerchCollections(products: readonly Product[]) {
  const sections = new Map<
    string,
    {
      id: string;
      name: string;
      brand: string;
      tagline: string;
      products: Product[];
    }
  >();
  for (const product of products) {
    const brand = product.brand || "Unlock Paradise";
    const name =
      product.collection ||
      (brand === "Unlock Paradise"
        ? "Unlock Paradise Collection"
        : "Other merchandise");
    const id = product.collectionId || `${product.brandId || brand}:${name}`;
    let section = sections.get(id);
    if (!section) {
      section = {
        id,
        name,
        brand,
        tagline: product.collectionTagline?.trim() || "",
        products: [],
      };
      sections.set(id, section);
    }
    section.products.push(product);
  }
  const priority = (section: { name: string; brand: string }) =>
    section.name.toLowerCase() === "unlock paradise collection" &&
    section.brand.toLowerCase() === "unlock paradise"
      ? 0
      : 1;
  return [...sections.values()].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      a.name.localeCompare(b.name, "en") ||
      a.brand.localeCompare(b.brand, "en"),
  );
}
