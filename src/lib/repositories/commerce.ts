import "server-only";
import { serverSupabase } from "@/lib/supabase/server";
import { databaseError } from "@/lib/http";
import type { Product } from "@/lib/merch-products";
import { withFocalPoint, type FocalPoint } from "@/lib/focal-point";

export type Variant = {
  id: string;
  label: string;
  sku: string;
  price_centavos: number;
  stock: number | null;
  active: boolean;
};
export function publicProduct(row: Record<string, unknown>): Product {
  const content = (row.content as Partial<Product>) || {};
  const images = row.images as {
    src: string;
    alt: string;
    focal?: FocalPoint;
  }[];
  const variants = (row.merch_variants as Variant[]).filter((v) => v.active);
  return {
    ...content,
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    price: Number(row.price_centavos) / 100,
    priceCentavos: Number(row.price_centavos),
    category: String(row.category),
    brandId: String(row.brand_id || ""),
    brand: String(
      (row.merch_brands as { name?: string } | null)?.name || "Unlock Paradise",
    ),
    collectionId: String(row.collection_id || ""),
    collection: String(
      (row.merch_collections as { name?: string } | null)?.name ||
        "Unlock Paradise Collection",
    ),
    collectionTagline: String(
      (row.merch_collections as { tagline?: string } | null)?.tagline || "",
    ),
    color: content.color || "",
    descriptor: content.descriptor || "",
    shortDescription: content.shortDescription || String(row.description),
    about: String(row.description),
    inStock: variants.some((v) => v.stock === null || v.stock > 0),
    rating: { value: 0, count: 0 },
    sizes: variants.map((v) => v.label),
    details: content.details || { material: "", fit: "", weight: "", care: "" },
    highlights: content.highlights || [],
    related: content.related || [],
    displayImage: withFocalPoint(images[0].src, images[0].focal),
    images: images.map((i) => withFocalPoint(i.src, i.focal)),
    imageAlts: images.map((i) => i.alt),
    variants,
  };
}
export async function catalog() {
  const db = await serverSupabase();
  const result = await db
    .from("merch_products")
    .select(
      "*,merch_variants(*),merch_brands(name),merch_collections!merch_products_collection_id_fkey(name,tagline)",
    )
    .eq("status", "publish")
    .order("featured", { ascending: false })
    .order("id")
    .limit(200);
  databaseError(result.error);
  return (result.data || []).map(publicProduct);
}
