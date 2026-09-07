import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

// Regression coverage for the bootstrap bug caught and fixed during
// Milestone 3 design: the original "skip a role entirely once it has any
// rows" fix would have locked staff.manage_roles out of the already-seeded
// production database on this exact deploy. These exercise the real,
// corrected seedPermissionsAndRoles() against real roles rather than a
// reimplementation of its logic.
describe.skipIf(!hasRealDb)("seed RBAC idempotency", () => {
  it("does not restore a manually-removed permission on re-seed", async () => {
    const { prisma } = await import("@/lib/db");
    const { seedPermissionsAndRoles } = await import("../prisma/seed");

    const role = await prisma.role.findUniqueOrThrow({ where: { name: "waiter" } });
    const before = await prisma.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
    expect(before.length).toBeGreaterThan(0);
    const removed = before[0];

    try {
      await prisma.rolePermission.delete({
        where: { roleId_permissionId: { roleId: role.id, permissionId: removed.permissionId } },
      });

      await seedPermissionsAndRoles();

      const after = await prisma.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
      const afterKeys = after.map((rp) => rp.permission.key);
      expect(afterKeys).not.toContain(removed.permission.key);
      expect(after.length).toBe(before.length - 1);
    } finally {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: removed.permissionId } },
        update: {},
        create: { roleId: role.id, permissionId: removed.permissionId },
      });
    }
  }, 30_000);

  it("backfills a key that's genuinely new to the system onto a role that already has other rows", async () => {
    const { prisma } = await import("@/lib/db");
    const { seedPermissionsAndRoles } = await import("../prisma/seed");
    const { ROLES } = await import("../lib/rbac-matrix");

    // sync.manage is a real, low-traffic permission — simulate it being
    // "brand new to the system" by deleting its Permission row entirely
    // (cascades to its RolePermission rows). Reseeding restores exactly the
    // production-intended state, so this test is self-cleaning.
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key: "sync.manage" } });
    const holdersBefore = await prisma.rolePermission.findMany({ where: { permissionId: permission.id } });
    expect(holdersBefore.length).toBeGreaterThan(0);

    await prisma.permission.delete({ where: { id: permission.id } });

    await seedPermissionsAndRoles();

    const restoredPermission = await prisma.permission.findUniqueOrThrow({ where: { key: "sync.manage" } });
    const holdersAfter = await prisma.rolePermission.findMany({
      where: { permissionId: restoredPermission.id },
      include: { role: true },
    });
    const holderRoleNames = holdersAfter.map((h) => h.role.name).sort();
    const expectedRoleNames = ROLES.filter((r) => r.permissions.includes("sync.manage"))
      .map((r) => r.name)
      .sort();
    expect(holderRoleNames).toEqual(expectedRoleNames);
  }, 30_000);

  it("seeds the full default set for a role with zero existing rows (true first-time bootstrap)", async () => {
    const { prisma } = await import("@/lib/db");
    const { seedPermissionsAndRoles } = await import("../prisma/seed");
    const { ROLES } = await import("../lib/rbac-matrix");

    const role = await prisma.role.findUniqueOrThrow({ where: { name: "housekeeper" } });
    const before = await prisma.rolePermission.findMany({ where: { roleId: role.id } });

    try {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await seedPermissionsAndRoles();

      const after = await prisma.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
      const afterKeys = after.map((rp) => rp.permission.key).sort();
      const expectedKeys = [...ROLES.find((r) => r.name === "housekeeper")!.permissions].sort();
      expect(afterKeys).toEqual(expectedKeys);
    } finally {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (before.length > 0) {
        await prisma.rolePermission.createMany({ data: before.map((b) => ({ roleId: b.roleId, permissionId: b.permissionId })) });
      }
    }
  }, 30_000);
});
