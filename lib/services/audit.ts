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
}) {
  await prisma.alert.create({
    data: {
      type: input.type,
      message: input.message,
      detail: input.detail,
      severity: input.severity ?? "MEDIUM",
      userId: input.userId,
    },
  });
}
