import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";
import type { RiskLevel } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "audit.view");
    const { searchParams } = request.nextUrl;
    const moduleFilter = searchParams.get("module");
    const risk = searchParams.get("risk");
    const limitParam = Number(searchParams.get("limit"));
    const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100;

    const logs = await prisma.auditLog.findMany({
      where: {
        module: moduleFilter || undefined,
        riskLevel: risk ? (risk.toUpperCase() as RiskLevel) : undefined,
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return ok(logs);
  } catch (err) {
    return handleRouteError(err);
  }
}
