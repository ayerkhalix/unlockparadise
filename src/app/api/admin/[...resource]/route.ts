import { z } from "zod";
import {
  api,
  ApiError,
  input,
  json,
  verifyOrigin,
  databaseError,
} from "@/lib/http";
import { requireStaff } from "@/lib/auth/session";
import { placeInput, uuid } from "@/lib/validation";
import { safeHtml } from "@/lib/html";
import { studioResources, studioGET, studioMutation } from "@/lib/admin-studio";
import { rateLimit } from "@/lib/rate-limit";
type Context = { params: Promise<{ resource: string[] }> };
export async function GET(request: Request, { params }: Context) {
  return api(async () => {
    const { resource } = await params;
    if (studioResources.has(resource[0])) return studioGET(request, resource);
    const current = await requireStaff(request);
    const [name, id] = resource;
    const url = new URL(request.url);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(url.searchParams.get("offset") || 0);
    if (name === "metrics") {
      const result = await current.db.rpc("admin_metrics");
      databaseError(result.error);
      return json(result.data);
    }
    if (name === "places") {
      let query = current.db
        .from("places")
        .select(
          id
            ? "*,place_details(*),place_areas(area_id),place_categories(category_id),place_media(kind,position,media_id)"
            : `id,title,slug,status,vip_content,premium_content,updated_at,place_areas${url.searchParams.get("area") ? "!inner" : ""}(area_id,areas(name)),place_categories${url.searchParams.get("category") ? "!inner" : ""}(category_id,categories(name)),place_media(kind,position,media_id)`,
          { count: "exact" },
        );
      if (id) {
        query = query.eq("id", uuid.parse(id));
      } else {
        const search = url.searchParams.get("search");
        if (search)
          query = query.ilike("title", "%" + search.replace(/[%_]/g, "") + "%");
        const status = url.searchParams.get("status");
        if (status)
          query = query.eq(
            "status",
            z.enum(["publish", "draft", "archived"]).parse(status),
          );
        const area = url.searchParams.get("area");
        if (area) query = query.eq("place_areas.area_id", uuid.parse(area));
        const category = url.searchParams.get("category");
        if (category)
          query = query.eq(
            "place_categories.category_id",
            uuid.parse(category),
          );
        const access = url.searchParams.get("access");
        if (access === "vip") query = query.eq("vip_content", true);
        else if (access === "standard") query = query.eq("vip_content", false);
      }
      const result = await query
        .order(
          url.searchParams.get("sort") === "title" ? "title" : "updated_at",
          { ascending: url.searchParams.get("sort") === "title" },
        )
        .order("id")
        .range(offset, offset + 24);
      databaseError(result.error);
      return json({ data: result.data, count: result.count });
    }
    if (name === "taxonomy") {
      const results = await Promise.all([
        current.db.from("areas").select("*").order("name"),
        current.db.from("categories").select("*").order("name"),
      ]);
      results.forEach((r) => databaseError(r.error));
      return json({ areas: results[0].data, categories: results[1].data });
    }
    const allowed: Record<string, string> = {
      media: "media",
      reviews: "reviews",
      users: "profiles",
      memberships: "subscriptions",
      entitlements: "entitlements",
      settings: "app_settings",
      contacts: "contact_messages",
      activity: "audit_logs",
      payments: "payment_transactions",
      events: "payment_events",
    };
    if (!allowed[name]) throw new ApiError(404, "Resource not found.");
    if (
      [
        "users",
        "memberships",
        "entitlements",
        "settings",
        "contacts",
        "activity",
        "payments",
        "events",
      ].includes(name)
    )
      await requireStaff(request, true);
    const fields =
      name === "users"
        ? "id,legacy_id,display_name,created_at,user_roles(role),entitlements(id,source,subscription_id,starts_at,expires_at,revoked_at),subscriptions(id,status,plan_id,paid_through,provider,created_at),payment_transactions(id,status,amount_centavos,paid_at,provider_payment_id)"
        : name === "memberships"
          ? "id,user_id,kind,status,plan_id,paid_through,provider,created_at"
          : name === "reviews"
            ? "id,place_id,author_name,rating,title,body,status,created_at,places(title),updated_at"
            : name === "activity"
              ? "id,actor_id,action,table_name,record_id,at,summary"
              : "*";
    let query = current.db
      .from(allowed[name])
      .select(fields, { count: "exact" });
    const search = url.searchParams.get("search");
    if (name === "users" && id) query = query.eq("id", uuid.parse(id));
    if (name === "users" && search)
      query = query.ilike(
        "display_name",
        "%" + search.replace(/[%_]/g, "").slice(0, 100) + "%",
      );
    if (name === "reviews") {
      if (id) query = query.eq("id", uuid.parse(id));
      const status = url.searchParams.get("status");
      if (status)
        query = query.eq(
          "status",
          z.enum(["pending", "approved", "rejected"]).parse(status),
        );
      if (search)
        query = query.ilike(
          "body",
          "%" + search.replace(/[%_]/g, "").slice(0, 100) + "%",
        );
    }
    if (name === "activity" && search)
      query = query.ilike(
        "table_name",
        "%" + search.replace(/[%_]/g, "").slice(0, 100) + "%",
      );
    if (name === "media" && search) {
      if (/^\d+$/.test(search)) query = query.eq("legacy_id", Number(search));
      else if (z.string().uuid().safeParse(search).success)
        query = query.eq("id", search);
      else
        query = query.ilike(
          "metadata->>title",
          "%" + search.replace(/[%_]/g, "") + "%",
        );
    }
    const result = await query
      .order(
        name === "activity" ? "at" : name === "settings" ? "key" : "created_at",
        { ascending: name === "settings" },
      )
      .range(offset, offset + 24);
    databaseError(result.error);
    if (name === "reviews" && id) {
      const history = await current.db.rpc("admin_review_history", { rid: id });
      databaseError(history.error);
      return json({
        data: result.data,
        count: result.count,
        history: history.data,
      });
    }
    return json({ data: result.data, count: result.count });
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { resource } = await params;
    if (studioResources.has(resource[0]))
      return studioMutation(request, resource);
    const current = await requireStaff(request);
    await rateLimit("admin-write", current.user.id, 90, 60);
    const [name] = resource;
    if (name === "places") {
      const body = await input(request, placeInput, 512000);
      body.description = safeHtml(body.description);
      body.content = safeHtml(body.content);
      const result = await current.db.rpc("admin_save_place", {
        pid: null,
        body,
      });
      databaseError(result.error);
      return json({ id: result.data }, 201);
    }
    if (name === "areas" || name === "categories") {
      const body = await input(
        request,
        z.object({
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .max(100),
          name: z.string().min(1).max(100),
          description: z.string().max(10000).default(""),
          latitude: z.number().min(-90).max(90).nullable().optional(),
          longitude: z.number().min(-180).max(180).nullable().optional(),
          visible: z.boolean().optional(),
        }),
      );
      if (name === "categories") {
        delete body.latitude;
        delete body.longitude;
        delete body.visible;
      }
      const result = await current.db
        .from(name)
        .insert(body)
        .select("id")
        .single();
      databaseError(result.error);
      return json({ data: result.data }, 201);
    }
    if (name === "entitlements") {
      await requireStaff(request, true);
      const body = await input(
        request,
        z.object({
          user_id: uuid,
          expires_at: z.iso.datetime().nullable(),
          reason: z.string().trim().min(5).max(1000),
        }),
      );
      if (body.expires_at && Date.parse(body.expires_at) <= Date.now())
        throw new ApiError(400, "Choose a future expiration.");
      const result = await current.db
        .from("entitlements")
        .insert({ ...body, source: "manual" })
        .select("id")
        .single();
      databaseError(result.error);
      return json({ data: result.data }, 201);
    }
    throw new ApiError(404, "Operation not found.");
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const { resource } = await params;
    if (studioResources.has(resource[0]))
      return studioMutation(request, resource);
    const current = await requireStaff(request);
    await rateLimit("admin-write", current.user.id, 90, 60);
    const [name, id] = resource;
    if (name === "places" && id) {
      uuid.parse(id);
      const body = await input(request, placeInput, 512000);
      body.description = safeHtml(body.description);
      body.content = safeHtml(body.content);
      const result = await current.db.rpc("admin_save_place", {
        pid: id,
        body,
      });
      databaseError(result.error);
      return json({ id: result.data });
    }
    if (name === "reviews" && id) {
      const body = await input(
        request,
        z.object({ status: z.enum(["pending", "approved", "rejected"]) }),
      );
      const result = await current.db
        .from("reviews")
        .update(body)
        .eq("id", uuid.parse(id))
        .select("id")
        .single();
      databaseError(result.error);
      return json({ data: result.data });
    }
    if (name === "media" && id) {
      const body = await input(
        request,
        z.object({
          alt: z.string().max(1000).optional(),
          status: z.enum(["ready", "rejected"]).optional(),
        }),
      );
      const result = await current.db
        .from("media")
        .update(body)
        .eq("id", uuid.parse(id))
        .select("id")
        .single();
      databaseError(result.error);
      return json({ data: result.data });
    }
    if (name === "areas" || name === "categories") {
      const body = await input(
        request,
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(10000),
          display_order: z.number().int().optional(),
          visible: z.boolean().optional(),
          latitude: z.number().min(-90).max(90).nullable().optional(),
          longitude: z.number().min(-180).max(180).nullable().optional(),
        }),
      );
      if (name === "categories") {
        delete body.visible;
        delete body.latitude;
        delete body.longitude;
      }
      const result = await current.db
        .from(name)
        .update(body)
        .eq("id", uuid.parse(id))
        .select("id")
        .single();
      databaseError(result.error);
      return json({ data: result.data });
    }
    await requireStaff(request, true);
    if (name === "users" && id) {
      uuid.parse(id);
      const body = await input(
        request,
        z
          .object({
            role: z.enum(["admin", "editor", "order_manager"]).nullable(),
          })
          .strict(),
      );
      const result = body.role
        ? await current.db
            .from("user_roles")
            .upsert({ user_id: id, role: body.role })
        : await current.db.from("user_roles").delete().eq("user_id", id);
      databaseError(result.error);
      return json({ updated: true });
    }
    if (name === "entitlements" && id) {
      const body = await input(request, z.object({ revoke: z.literal(true) }));
      void body;
      const result = await current.db
        .from("entitlements")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", uuid.parse(id));
      databaseError(result.error);
      return json({ updated: true });
    }
    if (name === "settings" && id) {
      const body = await input(request, z.object({ value: z.unknown() }));
      const result = await current.db
        .from("app_settings")
        .update(body)
        .eq("key", id)
        .select("key")
        .single();
      databaseError(result.error);
      return json({ updated: true });
    }
    throw new ApiError(404, "Operation not found.");
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => {
    verifyOrigin(request);
    const current = await requireStaff(request, true);
    const { resource } = await params;
    const [name, id] = resource;
    uuid.parse(id);
    if (name === "places") {
      const body = await input(request, z.object({ confirm_slug: z.string() }));
      const result = await current.db.rpc("admin_delete_place", {
        pid: id,
        confirm_slug: body.confirm_slug,
      });
      databaseError(result.error);
      return json({ deleted: true });
    }
    if (name === "areas" || name === "categories") {
      const result = await current.db
        .from(name)
        .delete()
        .eq("id", id)
        .select("id");
      databaseError(result.error);
      return json({ deleted: Boolean(result.data?.length) });
    }
    if (name === "media") {
      const body = await input(request, z.object({ confirm_id: uuid }));
      if (body.confirm_id !== id)
        throw new ApiError(400, "Confirm the exact media identifier.");
      const prepared = await current.db.rpc("admin_prepare_media_delete", {
        mid: id,
      });
      databaseError(prepared.error);
      const files = [
        {
          bucket: prepared.data.bucket,
          object_path: prepared.data.object_path,
        },
        ...(prepared.data.variants || []),
      ];
      for (const file of files) {
        const removed = await current.db.storage
          .from(file.bucket)
          .remove([file.object_path]);
        if (removed.error)
          throw new ApiError(
            503,
            "Media cleanup could not finish. The asset remains revoked for retry.",
          );
      }
      const result = await current.db.from("media").delete().eq("id", id);
      databaseError(result.error);
      return json({ deleted: true });
    }
    throw new ApiError(404, "Deletion is not available for this resource.");
  });
}
