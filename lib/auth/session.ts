import "server-only";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { withDbFallback, DbUnreachableError } from "@/lib/db-errors";
import { verifySessionToken, secretKey, SESSION_COOKIE_NAME, type SessionClaims } from "@/lib/auth/session-claims";
import { recordAudit } from "@/lib/services/audit";

const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h — matches the prototype's token lifetime

export async function createSessionCookie(userId: string, claims: SessionClaims) {
  const token = await new SignJWT({ sub: userId, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Reads the session cookie via next/headers (Server Component context) and
 * verifies it through the same logic proxy.ts uses on the raw request cookie
 * — see session-claims.ts for why the two must never diverge. */
async function readSessionClaims() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  roleId: string;
  roleName: string;
  shift: string | null;
  permissionKeys: string[];
  /** "db" = verified live just now (today's behavior). "jwt-fallback" = the
   * database was unreachable; this is trusted from the signed token alone,
   * bounded by its remaining lifetime — see recordAudit call below. */
  authSource: "db" | "jwt-fallback";
};

/**
 * Re-fetches the user + role from the database on every call when reachable,
 * deliberately not trusting anything beyond the JWT's claims — so deactivating
 * a staff account still takes effect on their very next request, same as
 * before. Only when the database is genuinely unreachable (not "user not
 * found", not "inactive" — those are real answers, never a fallback trigger)
 * does this fall back to the identity already embedded in the signed token,
 * which is exactly how the offline-sync system already treats a real
 * server rejection differently from a network failure
 * (lib/offline/sync-client.ts::submitOrQueue).
 *
 * Wrapped in React's `cache()` so repeated calls within one request/render
 * pass share a single DB round trip.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const claims = await readSessionClaims();
  if (!claims) return null;

  try {
    const user = await withDbFallback(() =>
      prisma.user.findUnique({ where: { id: claims.sub }, include: { role: true } })
    );
    if (!user || !user.active) return null;

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      roleId: user.roleId,
      roleName: user.role.name,
      shift: user.shift ?? null,
      permissionKeys: claims.permissionKeys,
      authSource: "db",
    };
  } catch (err) {
    if (!(err instanceof DbUnreachableError)) throw err;

    const fallback: SessionUser = {
      id: claims.sub,
      name: claims.name,
      username: claims.username,
      roleId: claims.roleId,
      roleName: claims.roleName,
      shift: claims.shift,
      permissionKeys: claims.permissionKeys,
      authSource: "jwt-fallback",
    };
    // Unconditional and DB-free, so this is never itself lost to the same outage.
    console.warn(`[auth] session ${fallback.id} validated via offline JWT fallback — database unreachable`);
    // Best-effort — if this can't land right now, it's because the database
    // is down, which is exactly the condition this is reporting.
    recordAudit({
      session: fallback,
      action: "Session validated via offline JWT fallback (database unreachable)",
      module: "System",
      riskLevel: "MEDIUM",
    }).catch(() => {});
    return fallback;
  }
});

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

/** For Route Handlers — throws, caught by handleRouteError() into a 401. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}

/** For Server Components/layouts — redirects to /login instead of throwing. */
export async function requireSessionForPage(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
