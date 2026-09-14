import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session-claims";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime, same purpose).
// This does a cheap, optimistic check — verify the cookie's JWT signature,
// expiry, and claims shape — enough to avoid a flash of dashboard content
// before bouncing to /login. It never reads the database: the authoritative
// check (is the user still active, does their role have the required
// permission) happens per-route via requireSession()/requirePermission() in
// lib/auth, right at the call site.
//
// This must use the same verification lib/auth/session.ts's getSession()
// uses, not just "does a session cookie exist" — a cookie can be present but
// fail validation (expired, forged, or signed under an older claims shape
// from before a payload change), and if this check and getSession() ever
// disagree about such a cookie, an unauthenticated visitor gets bounced
// between "/" and "/login" forever (ERR_TOO_MANY_REDIRECTS).
const PUBLIC_PATHS = ["/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!claims && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (claims && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|manifest.webmanifest|sw.js|icons|favicon.ico).*)"],
};
