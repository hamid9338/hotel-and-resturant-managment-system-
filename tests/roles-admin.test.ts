import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("roles admin service", () => {
  it("rejects editing the owner role's permissions (self-lockout guard)", async () => {
    const { prisma } = await import("@/lib/db");
    const { updateRolePermissions } = await import("@/lib/services/roles");

    const owner = await prisma.role.findUniqueOrThrow({ where: { name: "owner" } });
    const ownerUser = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
    const session = {
      id: ownerUser.id,
      name: ownerUser.name,
      username: ownerUser.username,
      roleId: ownerUser.roleId,
      roleName: "owner",
      shift: null,
    };

    await expect(updateRolePermissions(session, owner.id, { permissionKeys: [] })).rejects.toMatchObject({
      code: "OWNER_ROLE_LOCKED",
    });

    // Confirm the rejection was enforced before any write, not after a partial one.
    const stillIntact = await prisma.rolePermission.count({ where: { roleId: owner.id } });
    expect(stillIntact).toBeGreaterThan(0);
  }, 30_000);

  it("updates a non-owner role's permission set and hasPermission reflects it immediately", async () => {
    const { prisma } = await import("@/lib/db");
    const { updateRolePermissions } = await import("@/lib/services/roles");
    const { hasPermission } = await import("@/lib/auth/permissions");

    const role = await prisma.role.findUniqueOrThrow({ where: { name: "waiter" } });
    const waiterUser = await prisma.user.findFirstOrThrow({ where: { roleId: role.id } });
    const ownerUser = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
    const ownerSession = {
      id: ownerUser.id,
      name: ownerUser.name,
      username: ownerUser.username,
      roleId: ownerUser.roleId,
      roleName: "owner",
      shift: null,
    };
    const waiterSession = {
      id: waiterUser.id,
      name: waiterUser.name,
      username: waiterUser.username,
      roleId: role.id,
      roleName: "waiter",
      shift: null,
    };

    const before = await prisma.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
    const beforeKeys = before.map((rp) => rp.permission.key);
    expect(beforeKeys).not.toContain("inventory.view");

    try {
      await updateRolePermissions(ownerSession, role.id, { permissionKeys: [...beforeKeys, "inventory.view"] });

      const after = await prisma.rolePermission.findMany({ where: { roleId: role.id }, include: { permission: true } });
      expect(after.map((rp) => rp.permission.key)).toContain("inventory.view");
      expect(await hasPermission(waiterSession, "inventory.view")).toBe(true);
    } finally {
      await updateRolePermissions(ownerSession, role.id, { permissionKeys: beforeKeys });
    }
  }, 30_000);

  it("rejects an unknown permission key without writing anything", async () => {
    const { prisma } = await import("@/lib/db");
    const { updateRolePermissions } = await import("@/lib/services/roles");

    const role = await prisma.role.findUniqueOrThrow({ where: { name: "waiter" } });
    const ownerUser = await prisma.user.findFirstOrThrow({ where: { role: { name: "owner" } } });
    const ownerSession = {
      id: ownerUser.id,
      name: ownerUser.name,
      username: ownerUser.username,
      roleId: ownerUser.roleId,
      roleName: "owner",
      shift: null,
    };

    const before = await prisma.rolePermission.count({ where: { roleId: role.id } });

    await expect(
      updateRolePermissions(ownerSession, role.id, { permissionKeys: ["not.a.real.permission"] })
    ).rejects.toMatchObject({ code: "UNKNOWN_PERMISSION" });

    const after = await prisma.rolePermission.count({ where: { roleId: role.id } });
    expect(after).toBe(before);
  }, 30_000);
});
