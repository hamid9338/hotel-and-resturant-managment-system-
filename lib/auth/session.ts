import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h — matches the prototype's token lifetime

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to your environment."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionCookie(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

async function readUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  roleId: string;
  roleName: string;
  shift: string | null;
};

/**
 * Re-fetches the user + role from the database on every call, deliberately not
 * trusting anything beyond the user id embedded in the JWT. This means
 * deactivating a staff account takes effect on their very next request rather
 * than after up to 12h of remaining token validity.
 *
 * Wrapped in React's `cache()` so repeated calls within one request/render
 * pass share a single DB round trip.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const userId = await readUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    roleId: user.roleId,
    roleName: user.role.name,
    shift: user.shift ?? null,
  };
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
