import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/services/audit";
import { updateMenuItemSchema } from "@/lib/validation/restaurant";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.manage_menu");
    const input = updateMenuItemSchema.parse(await request.json());
    const { id } = await params;

    const item = await prisma.menuItem.update({ where: { id }, data: input });

    await recordAudit({
      session,
      action: `Menu item "${item.name}" updated`,
      module: "Restaurant",
      entityType: "MenuItem",
      entityId: item.id,
      newValue: input,
    });

    return ok(item);
  } catch (err) {
    return handleRouteError(err);
  }
}
