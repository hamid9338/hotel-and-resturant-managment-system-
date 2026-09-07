import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime, same purpose).
// This only does the cheap, optimistic check described in Next's auth guide:
// "is there a session cookie at all" — enough to avoid a flash of dashboard
// content before bouncing to /login. It never reads the database. The
// authoritative check (is the cookie's JWT valid, is the user still active,
// does their role have the required permission) happens per-route via
// requireSession()/requirePermission() in lib/auth, right at the call site.
const PUBLIC_PATHS = ["/login"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has("session");
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSessionCookie && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|manifest.webmanifest|sw.js|icons|favicon.ico).*)"],
};
