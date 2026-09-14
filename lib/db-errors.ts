import "server-only";
import { Prisma } from "@prisma/client";

// The exact Prisma error codes @prisma/adapter-pg maps real connectivity
// failures to (unreachable host, connection timeout, TLS failure, dropped
// connection, auth failure at connect time) — NOT "not found" or a
// constraint violation, which mean the database answered, just not "yes".
// Deliberately an allowlist: anything not on it rethrows unchanged, so an
// unrecognized future error can never silently become a fallback.
const UNREACHABLE_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1009", "P1010", "P1011", "P1017"]);

export class DbUnreachableError extends Error {
  constructor(public readonly cause: unknown) {
    super("Database is unreachable");
    this.name = "DbUnreachableError";
  }
}

function isConnectivityShaped(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return UNREACHABLE_CODES.has(err.code);
  // Thrown at connect time (before a query even runs) rather than per-query —
  // no .code, but always connectivity-shaped by definition.
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  return false;
}

/**
 * Races `run()` against a short timeout and normalizes every connectivity-
 * shaped failure into DbUnreachableError; anything else (the database
 * answered, just not "yes") rethrows unchanged — same fail-closed shape as
 * lib/offline/sync-client.ts::submitOrQueue's TypeError check on the client
 * side, applied to Prisma's error shapes on the server side.
 *
 * 4s is deliberately shorter than lib/db.ts's own 10s connectionTimeoutMillis
 * backstop (that's for a slow-but-real connection) and longer than a normal
 * Neon cold-start, so a merely-waking compute isn't misclassified as offline.
 */
const TIMEOUT_MS = 4_000;

export async function withDbFallback<T>(run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbUnreachableError(new Error("Database call timed out"))), TIMEOUT_MS);
  });

  try {
    return await Promise.race([run(), timeout]);
  } catch (err) {
    if (err instanceof DbUnreachableError) throw err;
    if (isConnectivityShaped(err)) throw new DbUnreachableError(err);
    throw err;
  } finally {
    clearTimeout(timer!);
  }
}
