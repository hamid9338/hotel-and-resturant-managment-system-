import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit, recordAlert } from "@/lib/services/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { updateRolePermissionsSchema } from "@/lib/validation/roles";

type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

export async function listRolesWithPermissions() {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      include: { permissions: { select: { permission: { select: { key: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] }),
  ]);

  return {
    permissions,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      permissionKeys: r.permissions.map((rp) => rp.permission.key),
    })),
  };
}

/**
 * Full-replacement semantics — the checkbox matrix submits a role's entire
 * desired permission set, not a diff. The owner role is locked out entirely,
 * unconditionally, regardless of who's acting: it's the only role seeded
 * with staff.manage_roles, so leaving it untouchable guarantees there is
 * always exactly one way back in, rather than requiring us to reason about
 * every combination of edits that could leave nobody able to manage roles.
 */
export async function updateRolePermissions(
  session: SessionUser,
  roleId: string,
  input: UpdateRolePermissionsInput
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError("ROLE_NOT_FOUND", "Role not found.", 404);
  if (role.name === "owner") {
    throw new AppError("OWNER_ROLE_LOCKED", "The owner role's permissions cannot be changed.", 403);
  }

  const validPermissions = await prisma.permission.findMany({
    where: { key: { in: input.permissionKeys } },
    select: { id: true, key: true },
  });
  if (validPermissions.length !== new Set(input.permissionKeys).size) {
    throw new AppError("UNKNOWN_PERMISSION", "One or more permission keys don't exist.", 400);
  }

  const before = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { key: true } } },
  });
  const oldKeys = before.map((rp) => rp.permission.key).sort();
  const newKeys = [...input.permissionKeys].sort();

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (validPermissions.length > 0) {
      await tx.rolePermission.createMany({
        data: validPermissions.map((p) => ({ roleId, permissionId: p.id })),
      });
    }
  });

  await recordAudit({
    session,
    action: `Role permissions updated: ${role.label}`,
    module: "Staff",
    entityType: "Role",
    entityId: role.id,
    oldValue: { permissionKeys: oldKeys },
    newValue: { permissionKeys: newKeys },
    riskLevel: "HIGH",
  });

  await recordAlert({
    type: "role_permissions_changed",
    message: `${role.label} role's permissions were changed by ${session.name}`,
    severity: "HIGH",
    entityId: role.id,
  });

  return listRolesWithPermissions();
}
