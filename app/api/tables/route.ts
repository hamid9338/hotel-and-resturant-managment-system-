import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.view");
    const tables = await prisma.restaurantTable.findMany({
      include: {
        orders: {
          where: { status: { notIn: ["BILLED", "CANCELLED"] } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { label: "asc" },
    });
    return ok(tables);
  } catch (err) {
    return handleRouteError(err);
  }
}
