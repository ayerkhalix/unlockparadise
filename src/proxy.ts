import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { backendConfigured, publicConfig } from "@/lib/supabase/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
let routing: Promise<Record<string, unknown>> | undefined;
export async function proxy(request: NextRequest) {
  if (
    /^\/(?:src|reference|scripts|supabase|artifacts|node_modules)(?:\/|$)/.test(
      request.nextUrl.pathname,
    )
  )
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  if (request.nextUrl.pathname.startsWith("/original/wp-content/uploads/")) {
    routing ??= readFile(
      path.join(process.cwd(), "src/lib/generated/media-routing.json"),
      "utf8",
    )
      .then(JSON.parse)
      .catch(() => ({}));
    const rules = await routing;
    let pathname = request.nextUrl.pathname;
    try {
      pathname = decodeURI(pathname);
    } catch {
      /* Invalid path remains unavailable. */
    }
    if (rules[pathname]) {
      const target = new URL("/api/local-media/", request.url);
      target.searchParams.set("path", pathname);
      return NextResponse.rewrite(target, {
        headers: { "Cache-Control": "private,no-store" },
      });
    }
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  if (!backendConfigured()) return response;
  const { url, key } = publicConfig();
  const db = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const claims = await db.auth.getClaims();
  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !claims.data?.claims.sub
  ) {
    const target = new URL("/login/", request.url);
    target.searchParams.set(
      "redirect_to",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|original|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|css|js|woff2)$).*)",
    "/original/wp-content/uploads/:path*",
    "/src/:path*",
    "/reference/:path*",
    "/scripts/:path*",
    "/supabase/:path*",
    "/artifacts/:path*",
    "/node_modules/:path*",
  ],
};
