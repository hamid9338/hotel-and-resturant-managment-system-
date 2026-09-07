import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createInventoryItemSchema } from "@/lib/validation/inventory";
import { createInventoryItem, listInventoryItems } from "@/lib/services/inventory";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.view");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const items = await listInventoryItems(includeInactive);
    return ok(items);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = createInventoryItemSchema.parse(await request.json());
    const item = await createInventoryItem(session, input);
    return ok(item, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
