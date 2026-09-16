import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { setRecipeSchema } from "@/lib/validation/restaurant";
import { getMenuItemRecipe, setMenuItemRecipe } from "@/lib/services/menu";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.manage_menu");
    const { id } = await params;
    const lines = await getMenuItemRecipe(id);
    return ok(lines);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.manage_menu");
    const input = setRecipeSchema.parse(await request.json());
    const { id } = await params;
    const lines = await setMenuItemRecipe(session, id, input);
    return ok(lines);
  } catch (err) {
    return handleRouteError(err);
  }
}
