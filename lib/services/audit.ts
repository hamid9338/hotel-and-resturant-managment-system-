import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import type { Prisma, RiskLevel } from "@prisma/client";

type AuditInput = {
  session: SessionUser | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  riskLevel?: RiskLevel;
  details?: string;
  ipAddress?: string | null;
};

export async function recordAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.session?.id,
      userName: input.session?.name ?? "System",
      userRole: input.session?.roleName ?? "system",
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      riskLevel: input.riskLevel ?? "NONE",
      details: input.details,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}

export async function recordAlert(input: {
  type: string;
  message: string;
  detail?: string;
  severity?: RiskLevel;
  userId?: string;
  entityId?: string;
}) {
  await prisma.alert.create({
    data: {
      type: input.type,
      message: input.message,
      detail: input.detail,
      severity: input.severity ?? "MEDIUM",
      userId: input.userId,
      entityId: input.entityId,
    },
  });
}

/**
 * Generalizes the find-unresolved/create-or-resolve dance
 * lib/services/inventory.ts::syncLowStockAlert already does inline for
 * low-stock alerts — additive, that working function is left untouched.
 * Any condition that can be continuously true/false (an anomaly threshold,
 * a stock level) calls this instead of recordAlert directly, so a
 * persisting condition doesn't spam duplicate alerts and clears itself
 * automatically once the condition normalizes.
 */
export async function syncDedupedAlert(input: {
  type: string;
  entityId: string;
  isActive: boolean;
  message: string;
  detail?: string;
  severity?: RiskLevel;
}) {
  const existing = await prisma.alert.findFirst({
    where: { type: input.type, entityId: input.entityId, resolved: false },
  });

  if (input.isActive && !existing) {
    await prisma.alert.create({
      data: {
        type: input.type,
        entityId: input.entityId,
        message: input.message,
        detail: input.detail,
        severity: input.severity ?? "MEDIUM",
      },
    });
  } else if (!input.isActive && existing) {
    await prisma.alert.update({ where: { id: existing.id }, data: { resolved: true, resolvedAt: new Date() } });
  }
}
