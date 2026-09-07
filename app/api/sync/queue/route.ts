import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "sync.view");
    const operations = await prisma.syncOperation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return ok(operations);
  } catch (err) {
    return handleRouteError(err);
  }
}
