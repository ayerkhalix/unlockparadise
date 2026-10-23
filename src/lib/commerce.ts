import { z } from "zod";

export const centavos = (value: string): number => {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a PHP amount with up to two decimals.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result > 100000000)
    throw new Error("The amount exceeds the supported limit.");
  return result;
};
export const moneyInput = (amount: number) =>
  `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
export const php = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount / 100)
    .replace(/\s/gu, " ");
const amount = z.number().int().min(0).max(100000000);
const text = (max: number) => z.string().trim().max(max);
export const productInput = z
  .object({
    name: text(200).min(1),
    slug: text(160).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    sku: text(80).min(1),
    description: text(10000),
    category: text(80).min(1),
    brand_id: z.string().uuid().optional(),
    collection_id: z.string().uuid().optional(),
    price_centavos: amount,
    compare_at_centavos: amount.nullable(),
    status: z.enum(["draft", "publish", "archived"]),
    featured: z.boolean(),
    images: z
      .array(
        z
          .object({
            src: text(500).regex(
              /^\/(?:merch\/images\/[a-zA-Z0-9_-]+\.(?:png|webp|jpe?g)|api\/media\/[0-9a-f-]{36}\/)$/,
            ),
            alt: text(300),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    content: z
      .object({
        descriptor: text(200).optional(),
        shortDescription: text(500).optional(),
        color: text(100).optional(),
        about: text(10000).optional(),
        badge: text(60).optional(),
        details: z.record(z.string().max(80), z.string().max(500)).optional(),
        highlights: z.array(text(300)).max(20).optional(),
        related: z.array(text(160)).max(8).optional(),
        sizeGuide: z
          .array(
            z.object({
              size: text(30),
              chest: text(30),
              length: text(30),
              shoulder: text(30),
            }),
          )
          .max(20)
          .optional(),
        seo: z.object({ title: text(160), description: text(320) }).optional(),
      })
      .strict(),
    variants: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            sku: text(80).min(1),
            label: text(100).min(1),
            price_centavos: amount,
            stock: z.number().int().min(0).max(1000000).nullable(),
            active: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    expected_version: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.compare_at_centavos !== null &&
      p.compare_at_centavos < p.price_centavos
    )
      ctx.addIssue({
        code: "custom",
        path: ["compare_at_centavos"],
        message: "Compare-at price must not be lower than the price.",
      });
    if (new Set(p.variants.map((v) => v.sku)).size !== p.variants.length)
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Each variant needs a unique SKU.",
      });
    if (new Set(p.variants.map((v) => v.label)).size !== p.variants.length)
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Each variant needs a unique option label.",
      });
  });
export type CatalogRow = z.infer<typeof productInput> & {
  id: number;
  version: number;
  updated_at: string;
  merch_variants: z.infer<typeof productInput>["variants"];
};

export function averageCentavos(total: number, count: number) {
  if (!count) return 0;
  const divisor = BigInt(count);
  return Number((BigInt(total) + divisor / BigInt(2)) / divisor);
}
