/**
 * Local-server background worker (Phase 2, see DEPLOYMENT-LOCAL.md): forwards
 * this site's locally-applied operations up to the cloud database whenever
 * internet is reachable, so the cloud stays a fresh backup/mirror. Runs as
 * its own persistent process (its own NSSM service), independent of the web
 * server — if it's down, staff on the LAN are completely unaffected; queued
 * operations just wait for it to come back.
 *
 * No-ops entirely (logs once and exits) when CLOUD_SYNC_TARGET_URL isn't
 * set — Phase 2 is optional and this script simply isn't meant to run
 * without it.
 *
 * Run with: npx tsx -r dotenv/config scripts/cloud-sync-worker.ts
 * (typically registered as a Windows service via NSSM instead of run by
 * hand — see DEPLOYMENT-LOCAL.md.)
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { SYNC_SERVICE_ACCOUNT_ID } from "./sync-service-account-id";

const POLL_INTERVAL_MS = 45_000;
const BATCH_SIZE = 50; // matches syncPushSchema's cap in lib/validation/sync.ts
const TOKEN_LIFETIME_SECONDS = 10 * 60;
const PUSH_TIMEOUT_MS = 15_000;

type PushResult = { id: string; status: "applied" | "duplicate" | "conflict" | "rejected"; reason?: string };

async function main() {
  const cloudTargetUrl = process.env.CLOUD_SYNC_TARGET_URL;
  if (!cloudTargetUrl) {
    console.log("[cloud-sync-worker] CLOUD_SYNC_TARGET_URL is not set — Phase 2 sync is disabled. Nothing to do.");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

  console.log(`[cloud-sync-worker] starting — target ${cloudTargetUrl}, polling every ${POLL_INTERVAL_MS / 1000}s`);

  for (;;) {
    try {
      await runOneCycle(prisma, secretKey, cloudTargetUrl);
    } catch (err) {
      console.error("[cloud-sync-worker] cycle failed unexpectedly:", err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOneCycle(prisma: PrismaClient, secretKey: Uint8Array, cloudTargetUrl: string) {
  const pending = await prisma.syncOperation.findMany({
    where: { status: "APPLIED", OR: [{ cloudPushStatus: null }, { cloudPushStatus: "PENDING" }] },
    orderBy: [{ createdAt: "asc" }, { seq: "asc" }],
    take: BATCH_SIZE,
  });
  if (pending.length === 0) return;

  const token = await mintServiceToken(prisma, secretKey);
  if (!token) {
    console.error(
      '[cloud-sync-worker] could not build a session token — has the "sync-service" account been created on this database? (scripts/create-service-account.ts)'
    );
    return;
  }

  const operations = pending.map((op) => ({
    id: op.id,
    deviceId: op.deviceId,
    operationKind: op.operationKind,
    entityId: op.entityId ?? undefined,
    payload: op.payload as Record<string, unknown>,
    clientTimestamp: op.clientTimestamp.toISOString(),
  }));

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
    try {
      res = await fetch(`${cloudTargetUrl}/api/sync/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
        body: JSON.stringify({ operations }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Still offline, or the cloud is unreachable right now — leave the whole
    // batch untouched for the next cycle, exactly like
    // lib/offline/sync-client.ts::flushOutbox does for the browser path.
    console.log(`[cloud-sync-worker] cloud unreachable — ${pending.length} operation(s) still pending, will retry.`);
    return;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    console.error(`[cloud-sync-worker] push rejected (HTTP ${res.status}) — leaving batch pending for retry.`, body?.error);
    return;
  }

  const results = body.data.results as PushResult[];
  for (const result of results) {
    if (result.status === "applied" || result.status === "duplicate") {
      await prisma.syncOperation.update({
        where: { id: result.id },
        data: { cloudPushStatus: "APPLIED", cloudPushedAt: new Date() },
      });
    } else {
      // "conflict" or "rejected" is a deterministic result from the cloud's
      // own business-rule check — retrying blindly won't change the outcome.
      // Flag it for a human instead (see components/sync/sync-queue-view.tsx)
      // rather than retrying forever.
      await prisma.syncOperation.update({
        where: { id: result.id },
        data: {
          cloudPushStatus: result.status === "conflict" ? "CONFLICT" : "FAILED",
          cloudConflictReason: result.reason ?? null,
          cloudPushAttempts: { increment: 1 },
        },
      });
    }
  }

  const counts = { applied: 0, duplicate: 0, conflict: 0, rejected: 0 };
  for (const r of results) counts[r.status]++;
  console.log(
    `[cloud-sync-worker] pushed ${results.length}: ${counts.applied} applied, ${counts.duplicate} duplicate, ${counts.conflict} conflict, ${counts.rejected} rejected.`
  );
}

/** Mirrors createSessionCookie() in lib/auth/session.ts, but minted directly
 * rather than via POST /api/auth/login — that endpoint's brute-force lockout
 * (5 attempts / 15 minutes, see LoginAttempt) would otherwise let an
 * automated retry loop lock itself out on any transient hiccup. */
async function mintServiceToken(prisma: PrismaClient, secretKey: Uint8Array): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: SYNC_SERVICE_ACCOUNT_ID }, include: { role: true } });
  if (!user || !user.active) return null;

  const permissionRows = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    select: { permission: { select: { key: true } } },
  });

  return new SignJWT({
    sub: user.id,
    roleId: user.roleId,
    roleName: user.role.name,
    permissionKeys: permissionRows.map((r) => r.permission.key),
    name: user.name,
    username: user.username,
    shift: user.shift,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`)
    .sign(secretKey);
}

main().catch((err) => {
  console.error("[cloud-sync-worker] fatal error:", err);
  process.exit(1);
});
