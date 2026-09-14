import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { withDbFallback, DbUnreachableError } from "@/lib/db-errors";
import type { SessionUser } from "@/lib/auth/session";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Cached per request: a route that checks several permission keys for the
// same session only pays for one query against RolePermission.
export const getRolePermissionKeys = cache(async (roleId: string): Promise<Set<string>> => {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { key: true } } },
  });
  return new Set(rows.map((r) => r.permission.key));
});

/**
 * The permission-checking counterpart to lib/auth/session.ts::getSession's
 * offline fallback — a separate DB dependency (RolePermission, not User), so
 * fixing session validation alone wasn't enough. Falls back to the
 * permission keys already embedded in the session's JWT (see SessionUser)
 * only when the database is genuinely unreachable, never on a real answer.
 */
export async function getSessionPermissionKeys(session: SessionUser): Promise<Set<string>> {
  try {
    return await withDbFallback(() => getRolePermissionKeys(session.roleId));
  } catch (err) {
    if (!(err instanceof DbUnreachableError)) throw err;
    return new Set(session.permissionKeys);
  }
}

export async function hasPermission(session: SessionUser, key: string): Promise<boolean> {
  const keys = await getSessionPermissionKeys(session);
  return keys.has(key);
}

/**
 * Authoritative, server-side permission gate. Call this at the top of every
 * route handler that performs a sensitive action — mirroring the old
 * `requirePermission(module, action)` middleware, but as an explicit call at
 * the call site so the required permission stays grep-able in the route file
 * itself rather than hidden in generic middleware.
 */
export async function requirePermission(session: SessionUser, key: string): Promise<void> {
  if (!(await hasPermission(session, key))) {
    throw new ForbiddenError(`${session.roleName} does not have permission "${key}"`);
  }
}
