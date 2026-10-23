import { z } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function safeRedirect(value: unknown, fallback = "/account/") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n\u0000-\u001f]/.test(value)
  )
    return fallback;
  try {
    if (
      new URL(value, "https://local.invalid").origin !== "https://local.invalid"
    )
      return fallback;
  } catch {
    return fallback;
  }
  return value;
}
export function verifyOrigin(request: Request) {
  if (request.headers.get("authorization")?.startsWith("Bearer ")) return;
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : requestUrl.origin;
  const permitted = new Set([expected]);
  if (process.env.NODE_ENV === "development") {
    if (!process.env.APP_URL) {
      const port = requestUrl.port || "3000";
      permitted.add("http://127.0.0.1:" + port);
      permitted.add("http://localhost:" + port);
    } else {
      const expectedUrl = new URL(expected);
      const localHosts = ["127.0.0.1", "localhost"];
      if (expectedUrl.protocol === "http:" && localHosts.includes(expectedUrl.hostname)) {
        expectedUrl.hostname =
          expectedUrl.hostname === "localhost" ? "127.0.0.1" : "localhost";
        permitted.add(expectedUrl.origin);
      }
      if (
        requestUrl.protocol === "http:" &&
        localHosts.includes(requestUrl.hostname)
      ) {
        for (const host of localHosts) {
          const localOrigin = new URL(requestUrl);
          localOrigin.hostname = host;
          permitted.add(localOrigin.origin);
        }
      }
    }
  }
  if (!origin || !permitted.has(origin))
    throw new ApiError(403, "Request origin is not allowed.");
}
export async function input<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 65536,
): Promise<T> {
  const raw = await boundedText(request, maxBytes);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Invalid JSON request.");
  }
  return schema.parse(parsed);
}
export async function boundedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function boundedText(request: Request, maxBytes: number) {
  return new TextDecoder().decode(await boundedBody(request, maxBytes));
}
export async function uploadForm(request: Request, maxBytes: number) {
  const bytes = await boundedBody(request, maxBytes);
  try {
    return await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new ApiError(400, "Invalid upload form.");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function api(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: "Check the supplied fields.",
          fields: error.issues.map((x) => ({
            path: x.path,
            message: x.message,
          })),
        },
        400,
      );
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    if (error instanceof Error && error.message === "BACKEND_UNCONFIGURED")
      return json(
        {
          error:
            "Account and database services are not configured for this environment.",
        },
        503,
      );
    console.error(
      JSON.stringify({
        event: "backend_request_failed",
        name: error instanceof Error ? error.name : "unknown",
      }),
    );
    return json(
      { error: "The request could not be completed. Please try again." },
      500,
    );
  }
}
export function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "PT409")
    throw new ApiError(
      409,
      "This record changed. Reload before saving; your input has been kept.",
    );
  if (error.code === "PT404")
    throw new ApiError(404, "This record is no longer available.");
  console.error(
    JSON.stringify({
      event: "database_query_failed",
      code: /^[A-Z0-9_]{1,20}$/.test(error.code || "") ? error.code : "unknown",
    }),
  );
  if (["PGRST301", "PGRST302", "PGRST303"].includes(error.code || ""))
    throw new ApiError(401, "Your session is invalid or has expired.");
  if (error.code === "23505")
    throw new ApiError(409, "This record already exists.");
  if (error.code === "42501")
    throw new ApiError(
      403,
      "You do not have permission to perform this action.",
    );
  if (error.code === "23503")
    throw new ApiError(
      409,
      "This record is still referenced by other content.",
    );
  if (error.code === "22023" || error.code === "23514")
    throw new ApiError(400, "The supplied data is not valid.");
  throw new ApiError(
    503,
    "The database service could not complete this request.",
  );
}
