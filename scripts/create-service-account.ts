/**
 * One-off script: creates the "sync-service" User row that
 * scripts/cloud-sync-worker.ts authenticates as when forwarding a local
 * server's queued operations to the cloud (see DEPLOYMENT-LOCAL.md, Phase 2).
 *
 * Run this ONCE against each database (local and cloud), with the SAME fixed
 * id below both times, so the account resolves to the same identity on
 * either side — don't rely on the Phase-1 pg_dump/restore to carry this row
 * over instead: by the time you're setting up Phase 2, the local database
 * has likely diverged from the cloud with real, local-only data.
 *
 * Idempotent — safe to re-run against a database that already has this row
 * (upserts on the fixed id).
 *
 * Prerequisite: `npm run db:seed` must already have run against this
 * database, since that's what creates the "sync_service" role this account
 * needs (see lib/rbac-matrix.ts).
 *
 * Run with: npx tsx -r dotenv/config scripts/create-service-account.ts
 * (DATABASE_URL must point at whichever database — local or cloud — you're
 * creating the account in for this run.)
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { SYNC_SERVICE_ACCOUNT_ID } from "./sync-service-account-id";

const USERNAME = "sync-service";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — point this at the database you're creating the account in.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const role = await prisma.role.findUnique({ where: { name: "sync_service" } });
  if (!role) {
    throw new Error('The "sync_service" role does not exist yet — run `npm run db:seed` against this database first.');
  }

  // Never used for interactive login (nothing signs in as this account
  // through the normal login form) — only exists so the worker can look up
  // this user's id/role locally and so that id resolves on the cloud side
  // too. Random and discarded immediately; nobody needs to know it.
  const randomPin = crypto.randomBytes(16).toString("hex");
  const pinHash = await bcrypt.hash(randomPin, 10);

  await prisma.user.upsert({
    where: { id: SYNC_SERVICE_ACCOUNT_ID },
    update: { roleId: role.id },
    create: {
      id: SYNC_SERVICE_ACCOUNT_ID,
      name: "Sync Service",
      username: USERNAME,
      pinHash,
      roleId: role.id,
      shift: null,
    },
  });

  console.log(`sync-service account ready (id: ${SYNC_SERVICE_ACCOUNT_ID}) on ${process.env.DATABASE_URL.split("@")[1] ?? "this database"}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
