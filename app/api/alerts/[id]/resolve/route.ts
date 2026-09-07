import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/services/audit";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "alerts.resolve");
    const { id } = await params;
    const alert = await prisma.alert.update({
      where: { id },
      data: { resolved: true, resolvedById: session.id, resolvedAt: new Date() },
    });
    await recordAudit({
      session,
      action: `Alert resolved: ${alert.message}`,
      module: "System",
      entityType: "Alert",
      entityId: alert.id,
    });
    return ok(alert);
  } catch (err) {
    return handleRouteError(err);
  }
}
