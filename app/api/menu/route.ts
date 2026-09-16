import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { createMenuItemSchema } from "@/lib/validation/restaurant";
import { createMenuItem } from "@/lib/services/menu";
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.manage_menu");
    const input = createMenuItemSchema.parse(await request.json());
    const item = await createMenuItem(session, input);
    return ok(item, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
