import { notFound } from "next/navigation";
import { catalog } from "@/lib/repositories/commerce";
import { ProductDetail } from "@/components/merch/store";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await catalog()).find((p) => p.slug === slug);
  return {
    title: product?.seo?.title || product?.name || "Product unavailable",
    description: product?.seo?.description || product?.shortDescription,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await catalog()).find((p) => p.slug === slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
