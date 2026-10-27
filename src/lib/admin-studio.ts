import "server-only";
import { z } from "zod";
import { requireStaff, requireOrders } from "@/lib/auth/session";
import { ApiError, databaseError, input, json, verifyOrigin } from "@/lib/http";
import { productInput } from "@/lib/commerce";
import { rateLimit } from "@/lib/rate-limit";
import { paymentProvider } from "@/lib/payments/provider";
import { safeHtml } from "@/lib/html";
import { products as importedCatalog } from "@/lib/merch-products";

export const studioResources = new Set([
  "merchandise",
  "merchandise-assets",
  "orders",
  "sales",
  "analytics",
  "integrations",
]);
const positiveId = z.coerce.number().int().positive();
function period(url: URL) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const end = z.iso.date().parse(url.searchParams.get("to") || today);
  const start = z.iso
    .date()
    .parse(
      url.searchParams.get("from") ||
        new Date(Date.parse(end + "T00:00:00Z") - 29 * 86400000)
          .toISOString()
          .slice(0, 10),
    );
  if (start > end || Date.parse(end) - Date.parse(start) > 92 * 86400000)
    throw new ApiError(400, "Choose a period of up to 93 days.");
  return { first_day: start, last_day: end };
}
export async function studioGET(request: Request, resource: string[]) {
  const [name, id] = resource;
  const current =
    name === "orders" || name === "sales"
      ? await requireOrders(request)
      : await requireStaff(request, true);
  const url = new URL(request.url);
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(url.searchParams.get("offset") || 0);
  const search = (url.searchParams.get("search") || "")
    .slice(0, 200)
    .replace(/[%_,()]/g, "");
  if (name === "merchandise-assets") {
    const local = importedCatalog
      .flatMap((p) =>
        p.images.map((src, i) => ({
          src,
          alt: p.name,
          label: `${p.name} · Photo ${i + 1}`,
        })),
      )
      .filter(
        (p) => !search || p.label.toLowerCase().includes(search.toLowerCase()),
      );
    let query = current.db
      .from("media")
      .select("id,alt,legacy_id")
      .eq("bucket", "destination-public")
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(50);
    if (search) query = query.ilike("alt", "%" + search + "%");
    const uploaded = await query;
    databaseError(uploaded.error);
    return json({
      data: [
        ...local,
        ...(uploaded.data || []).map((m) => ({
          src: `/api/media/${m.id}/`,
          alt: m.alt,
          label:
            m.alt ||
            `Uploaded photo ${m.legacy_id || String(m.id).slice(0, 8)}`,
        })),
      ],
    });
  }
  if (name === "merchandise") {
    let query = current.db
      .from("merch_products")
      .select(
        "*,merch_variants(*),merch_collections!merch_products_collection_id_fkey(name)",
        {
          count: "exact",
        },
      );
    if (id) query = query.eq("id", positiveId.parse(id));
    else {
      if (search)
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      const status = url.searchParams.get("status");
      if (status)
        query = query.eq(
          "status",
          z.enum(["draft", "publish", "archived"]).parse(status),
        );
      const category = url.searchParams.get("category");
      if (category) query = query.eq("category", category.slice(0, 80));
      const collection = url.searchParams.get("collection");
      if (collection)
        query = query.eq("collection_id", z.uuid().parse(collection));
    }
    const result = await query
      .order(url.searchParams.get("sort") === "name" ? "name" : "updated_at", {
        ascending: url.searchParams.get("sort") === "name",
      })
      .order("id")
      .range(offset, offset + 24);
    databaseError(result.error);
    return json({ data: result.data, count: result.count });
  }
  if (name === "orders") {
    let query = current.db
      .from("merch_orders")
      .select(
        "id,user_id,total_centavos,refunded_centavos,currency,payment_status,fulfillment_status,provider_session_id,provider_payment_id,internal_note,paid_at,version,created_at,updated_at,merch_order_items(id,product_id,product_name,variant_label,sku,quantity,unit_centavos)",
        { count: "exact" },
      );
    if (id) query = query.eq("id", z.string().uuid().parse(id));
    if (search) {
      const parsed = z.string().uuid().safeParse(search);
      if (!parsed.success) return json({ data: [], count: 0 });
      query = query.eq("id", parsed.data);
    }
    const payment = url.searchParams.get("payment");
    if (payment)
      query = query.eq(
        "payment_status",
        z
          .enum([
            "pending",
            "paid",
            "partially_refunded",
            "refunded",
            "failed",
            "expired",
          ])
          .parse(payment),
      );
    const fulfillment = url.searchParams.get("fulfillment");
    if (fulfillment)
      query = query.eq(
        "fulfillment_status",
        z
          .enum([
            "unfulfilled",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
          ])
          .parse(fulfillment),
      );
    const exporting = url.searchParams.get("format") === "csv";
    const result = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(exporting ? 0 : offset, exporting ? 999 : offset + 24);
    databaseError(result.error);
    if (exporting) {
      const cell = (v: unknown) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+@-]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const keys = [
        "id",
        "created_at",
        "payment_status",
        "fulfillment_status",
        "currency",
        "total_centavos",
        "refunded_centavos",
      ] as const;
      const csv = [
        keys.join(","),
        ...(result.data || []).map((row) =>
          keys.map((k) => cell(row[k])).join(","),
        ),
      ].join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            "attachment; filename=unlock-paradise-orders.csv",
          "Cache-Control": "private, no-store",
        },
      });
    }
    return json({ data: result.data, count: result.count });
  }
  if (name === "sales" || name === "analytics") {
    if (name === "analytics") {
      const metric = z
        .enum(["views", "saves", "planned"])
        .parse(url.searchParams.get("metric") || "views");
      const bounds = period(url);
      const [summary, ranked] = await Promise.all([
        current.db.rpc("admin_analytics", bounds),
        current.db.rpc("admin_ranked_interest", { ...bounds, metric }),
      ]);
      databaseError(summary.error);
      databaseError(ranked.error);
      return json({
        ...summary.data,
        places: ranked.data,
        rank_metric: metric,
      });
    }
    const result = await current.db.rpc("admin_sales_summary", period(url));
    databaseError(result.error);
    return json(result.data);
  }
  if (name === "integrations") {
    const usage = await current.db.rpc("admin_media_usage");
    databaseError(usage.error);
    const result = await current.db
      .from("media")
      .select("id", { count: "exact", head: true });
    databaseError(result.error);
    return json({
      project: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
        ".",
      )[0],
      payments:
        paymentProvider() === "xendit"
          ? process.env.UPD_ENVIRONMENT === "staging" &&
            process.env.XENDIT_SECRET_KEY?.startsWith("xnd_development_") &&
            !!process.env.XENDIT_WEBHOOK_TOKEN
            ? "sandbox"
            : "unavailable"
          : process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_test_") &&
              !!process.env.PAYMONGO_WEBHOOK_SECRET
            ? "sandbox"
            : "unavailable",
      payment_provider: paymentProvider(),
      merch_checkout: "disabled",
      analytics: "consent-based first-party",
      email: process.env.SMTP_HOST
        ? "configured; delivery verification required"
        : "unavailable",
      media_records: result.count,
      upload_limit_bytes: 20971520,
      storage:
        "Existing mappings retained. Small uploads only; quota usage is authoritative in Supabase Storage.",
      stored_bytes: usage.data?.stored_bytes,
    });
  }
  throw new ApiError(404, "Resource unavailable.");
}
export async function studioMutation(request: Request, resource: string[]) {
  verifyOrigin(request);
  const [name, id, action] = resource;
  const current =
    name === "orders"
      ? await requireOrders(request)
      : await requireStaff(request, true);
  await rateLimit("admin-studio", current.user.id, 90, 60);
  if (name === "merchandise") {
    let body;
    if (action === "duplicate" && id && request.method === "POST") {
      const source = await current.db
        .from("merch_products")
        .select("*,merch_variants(*)")
        .eq("id", positiveId.parse(id))
        .single();
      databaseError(source.error);
      const p = source.data,
        suffix = crypto.randomUUID().slice(0, 8);
      body = productInput.parse({
        ...Object.fromEntries(
          [
            "name",
            "slug",
            "sku",
            "description",
            "category",
            "brand_id",
            "collection_id",
            "price_centavos",
            "compare_at_centavos",
            "featured",
            "images",
            "content",
          ].map((k) => [k, p[k]]),
        ),
        name: p.name + " (copy)",
        slug: p.slug + "-" + suffix,
        sku: p.sku + "-" + suffix,
        status: "draft",
        variants: p.merch_variants
          .filter((v: { active: boolean }) => v.active)
          .map(
            (v: {
              sku: string;
              label: string;
              price_centavos: number;
              stock: number | null;
              active: boolean;
            }) => ({
              sku: v.sku + "-" + suffix,
              label: v.label,
              price_centavos: v.price_centavos,
              stock: 0,
              active: v.active,
            }),
          ),
      });
    } else body = await input(request, productInput, 128000);
    body.description = safeHtml(body.description);
    const result = await current.db.rpc("admin_save_product", {
      pid: action === "duplicate" || !id ? null : positiveId.parse(id),
      expected_version: body.expected_version ?? null,
      body,
    });
    databaseError(result.error);
    return json({ id: result.data }, request.method === "POST" ? 201 : 200);
  }
  if (name === "orders" && id && request.method === "PATCH") {
    const body = await input(
      request,
      z
        .object({
          expected_version: z.number().int().positive(),
          fulfillment_status: z.enum([
            "unfulfilled",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
          ]),
          internal_note: z.string().max(2000),
        })
        .strict(),
    );
    const result = await current.db.rpc("admin_fulfill_order", {
      oid: z.string().uuid().parse(id),
      expected_version: body.expected_version,
      state: body.fulfillment_status,
      note: body.internal_note,
    });
    databaseError(result.error);
    return json({ updated: true });
  }
  throw new ApiError(404, "Operation unavailable.");
}
