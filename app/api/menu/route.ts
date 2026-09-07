import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.view");
    const items = await prisma.menuItem.findMany({
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return ok(items);
  } catch (err) {
    return handleRouteError(err);
  }
}
