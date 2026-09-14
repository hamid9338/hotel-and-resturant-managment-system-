import { jwtVerify } from "jose";
import { sessionClaimsSchema } from "@/lib/validation/auth";

export const SESSION_COOKIE_NAME = "session";

/** Everything needed to build a SessionUser from the JWT alone, with no
 * database access — this is what makes the offline fallback in session.ts
 * possible. */
export type SessionClaims = {
  roleId: string;
  roleName: string;
  permissionKeys: string[];
  name: string;
  username: string;
  shift: string | null;
};

// Fails at module load (the first request in a cold serverless instance that
// touches anything auth-related — including proxy.ts, which runs before any
// page) rather than only surfacing deep inside a login/session-read call.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to your environment."
  );
}

export function secretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

/**
 * Verifies a raw session JWT's signature, expiry, and claims shape only —
 * zero database access. Returns null for a missing, expired, forged, or
 * schema-incompatible token (e.g. one signed under an older claims shape,
 * from before a payload change) so every caller treats it uniformly as
 * "not logged in" instead of each reaching a different conclusion. Shared
 * by proxy.ts (via the request's raw cookie) and session.ts's getSession()
 * (via next/headers's cookies()) specifically so they can never disagree —
 * an earlier version had proxy.ts check mere cookie *presence* while
 * getSession() did full validation, which meant a stale/invalid cookie
 * bounced a visitor between "/" and "/login" forever.
 */
export async function verifySessionToken(token: string | undefined): Promise<({ sub: string } & SessionClaims) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const parsed = sessionClaimsSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
