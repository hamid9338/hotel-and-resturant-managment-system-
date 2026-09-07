import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { createStaffSchema, updateStaffSchema } from "@/lib/validation/staff";

type CreateStaffInput = z.infer<typeof createStaffSchema>;
type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

const staffSelect = {
  id: true,
  name: true,
  username: true,
  shift: true,
  active: true,
  createdAt: true,
  role: { select: { id: true, name: true, label: true } },
} as const;

export async function listStaff() {
  return prisma.user.findMany({
    select: staffSelect,
    orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
  });
}

export async function createStaff(session: SessionUser, input: CreateStaffInput) {
  const role = await prisma.role.findUnique({ where: { name: input.roleName } });
  if (!role) throw new AppError("ROLE_NOT_FOUND", "Unknown role.", 400);

  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) throw new AppError("USERNAME_TAKEN", "That username is already taken.", 409);

  const pinHash = await bcrypt.hash(input.pin, 10);
  const user = await prisma.user.create({
    data: { name: input.name, username: input.username, pinHash, roleId: role.id, shift: input.shift },
    select: staffSelect,
  });

  await recordAudit({
    session,
    action: `New staff created: ${user.name} (${role.label})`,
    module: "Staff",
    entityType: "User",
    entityId: user.id,
  });

  return user;
}

export async function updateStaff(
  session: SessionUser,
  targetId: string,
  input: UpdateStaffInput,
  actingRole: string
) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, include: { role: true } });
  if (!target) throw new AppError("STAFF_NOT_FOUND", "Staff member not found.", 404);

  // Only the owner can change roles or activation — matches the prototype's rule exactly.
  if ((input.roleName || input.active !== undefined) && actingRole !== "owner") {
    throw new AppError("FORBIDDEN", "Only the owner can change roles or activation status.", 403);
  }

  const data: { name?: string; shift?: string; active?: boolean; roleId?: string; pinHash?: string } = {};
  if (input.name) data.name = input.name;
  if (input.shift) data.shift = input.shift;
  if (input.active !== undefined) data.active = input.active;
  if (input.roleName) {
    const role = await prisma.role.findUnique({ where: { name: input.roleName } });
    if (!role) throw new AppError("ROLE_NOT_FOUND", "Unknown role.", 400);
    data.roleId = role.id;
  }
  if (input.pin) data.pinHash = await bcrypt.hash(input.pin, 10);

  const updated = await prisma.user.update({ where: { id: targetId }, data, select: staffSelect });

  // Never write the PIN hash into the audit trail.
  const auditableChanges: Record<string, unknown> = { ...data };
  delete auditableChanges.pinHash;

  await recordAudit({
    session,
    action: `Staff ${target.name} updated`,
    module: "Staff",
    entityType: "User",
    entityId: target.id,
    newValue: auditableChanges as Prisma.InputJsonValue,
  });

  return updated;
}
