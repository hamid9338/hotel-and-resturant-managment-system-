import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { createMenuCategorySchema } from "@/lib/validation/restaurant";
import { createMenuCategory } from "@/lib/services/menu";
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.manage_menu");
    const input = createMenuCategorySchema.parse(await request.json());
    const category = await createMenuCategory(session, input);
    return ok(category, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
