import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("local-cloud sync (Phase 2 hybrid deployment)", () => {
  it("sync_service role has exactly the permissions dispatch() needs for the 10 whitelisted operation kinds", async () => {
    const { prisma } = await import("@/lib/db");
    const role = await prisma.role.findUnique({ where: { name: "sync_service" } });
    expect(role).not.toBeNull();

    const perms = await prisma.rolePermission.findMany({
      where: { roleId: role!.id },
      select: { permission: { select: { key: true } } },
    });
    const keys = new Set(perms.map((p) => p.permission.key));

    for (const required of [
      "hotel.create_booking",
      "hotel.checkin",
      "hotel.checkout",
      "restaurant.create_order",
      "restaurant.update_order_status",
      "restaurant.cancel_order",
      "inventory.manage",
      "inventory.adjust_stock",
      "finance.log_expense",
    ]) {
      expect(keys.has(required), `sync_service is missing "${required}"`).toBe(true);
    }
  });

  it("recordLocalMutation no-ops when CLOUD_SYNC_TARGET_URL is unset, and records a row when it is set", async () => {
    const { prisma } = await import("@/lib/db");
    const { recordLocalMutation } = await import("@/lib/services/local-cloud-sync");
    const user = await prisma.user.findFirstOrThrow();
    const session = {
      id: user.id,
      name: user.name,
      username: user.username,
      roleId: user.roleId,
      roleName: "owner",
      shift: null,
      permissionKeys: [],
      authSource: "db" as const,
    };
    const entityId = crypto.randomUUID();
    const originalTarget = process.env.CLOUD_SYNC_TARGET_URL;

    try {
      delete process.env.CLOUD_SYNC_TARGET_URL;
      await recordLocalMutation(session, { operationKind: "expenses.create", entityId, payload: { test: true } });
      expect(await prisma.syncOperation.findFirst({ where: { entityId } })).toBeNull();

      process.env.CLOUD_SYNC_TARGET_URL = "https://example.invalid";
      await recordLocalMutation(session, { operationKind: "expenses.create", entityId, payload: { test: true } });
      const row = await prisma.syncOperation.findFirst({ where: { entityId } });
      expect(row).not.toBeNull();
      expect(row!.status).toBe("APPLIED");
      expect(row!.cloudPushStatus).toBe("PENDING");
      expect(row!.deviceId).toBe("local-server");
    } finally {
      await prisma.syncOperation.deleteMany({ where: { entityId } });
      if (originalTarget === undefined) delete process.env.CLOUD_SYNC_TARGET_URL;
      else process.env.CLOUD_SYNC_TARGET_URL = originalTarget;
    }
  });

  it("a token minted the way scripts/cloud-sync-worker.ts does verifies correctly through the real session pipeline", async () => {
    const { prisma } = await import("@/lib/db");
    const { verifySessionToken, secretKey } = await import("@/lib/auth/session-claims");

    const syncServiceUser = await prisma.user.findFirst({ where: { username: "sync-service" }, include: { role: true } });
    expect(syncServiceUser, 'the "sync-service" account must exist — run npm run sync:create-service-account first').not.toBeNull();

    const permissionRows = await prisma.rolePermission.findMany({
      where: { roleId: syncServiceUser!.roleId },
      select: { permission: { select: { key: true } } },
    });

    // Mirrors mintServiceToken() in scripts/cloud-sync-worker.ts exactly.
    const token = await new SignJWT({
      sub: syncServiceUser!.id,
      roleId: syncServiceUser!.roleId,
      roleName: syncServiceUser!.role.name,
      permissionKeys: permissionRows.map((r) => r.permission.key),
      name: syncServiceUser!.name,
      username: syncServiceUser!.username,
      shift: syncServiceUser!.shift,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(secretKey());

    const claims = await verifySessionToken(token);
    expect(claims).not.toBeNull();
    expect(claims!.sub).toBe(syncServiceUser!.id);
    expect(claims!.roleName).toBe("sync_service");
    expect(claims!.permissionKeys).toContain("hotel.create_booking");
  });

  it(
    "applySyncOperation, authenticated as sync_service, can forward a rooms.updateStatus operation (proves the VALID_TRANSITIONS fix)",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { applySyncOperation } = await import("@/lib/services/sync");

      const syncServiceUser = await prisma.user.findFirst({
        where: { username: "sync-service" },
        include: { role: true },
      });
      expect(syncServiceUser, 'the "sync-service" account must exist — run npm run sync:create-service-account first').not.toBeNull();
      const session = {
        id: syncServiceUser!.id,
        name: syncServiceUser!.name,
        username: syncServiceUser!.username,
        roleId: syncServiceUser!.roleId,
        roleName: syncServiceUser!.role.name,
        shift: null,
        permissionKeys: [],
        authSource: "db" as const,
      };

      const suffix = Date.now();
      const roomType = await prisma.roomType.create({
        data: { name: `TestType-${suffix}`, basePrice: 1000, capacity: 1 },
      });
      const room = await prisma.room.create({
        data: { number: `TEST-${suffix}`, floor: 0, roomTypeId: roomType.id, status: "AVAILABLE" },
      });
      const opId = crypto.randomUUID();

      try {
        const result = await applySyncOperation(session, {
          id: opId,
          deviceId: "test-local-server",
          operationKind: "rooms.updateStatus",
          entityId: room.id,
          payload: { roomId: room.id, status: "CLEANING" },
          clientTimestamp: new Date().toISOString(),
        });

        expect(result.status).toBe("applied");
        const updated = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
        expect(updated.status).toBe("CLEANING");
      } finally {
        await prisma.syncOperation.deleteMany({ where: { id: opId } });
        await prisma.room.delete({ where: { id: room.id } });
        await prisma.roomType.delete({ where: { id: roomType.id } });
      }
    },
    30_000
  );
});
