import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.view");
    const categories = await prisma.menuCategory.findMany({ orderBy: { sortOrder: "asc" } });
    return ok(categories);
  } catch (err) {
    return handleRouteError(err);
  }
}
