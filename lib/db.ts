import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prisma 7 requires an explicit driver adapter for direct database connections
// (schema.prisma no longer carries a `url`; see prisma.config.ts for the CLI side).
// Vercel Postgres (Neon-backed) provides a pooled connection string — use that as
// DATABASE_URL in production so this pool isn't what's guarding against exhausting
// Postgres's own connection limit under serverless concurrency.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
