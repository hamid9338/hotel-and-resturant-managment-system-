import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";
import type { BillType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "ocr.view");
    const type = request.nextUrl.searchParams.get("type");
    const bills = await prisma.oCRBill.findMany({
      where: type ? { billType: type as BillType } : undefined,
      include: {
        scannedBy: { select: { name: true } },
        verifiedBy: { select: { name: true } },
      },
      orderBy: { scannedAt: "desc" },
      take: 50,
    });
    return ok(bills);
  } catch (err) {
    return handleRouteError(err);
  }
}
