import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { postOcrBillToInventorySchema } from "@/lib/validation/inventory";
import { postOcrBillToInventory } from "@/lib/services/inventory";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    // Deliberately a second, higher-bar permission than ocr.verify — checking
    // a scan's transcription and being authorized to commit it to the stock
    // ledger are different trust levels.
    await requirePermission(session, "inventory.manage");
    const input = postOcrBillToInventorySchema.parse(await request.json());
    const { id } = await params;
    const result = await postOcrBillToInventory(session, id, input);
    return ok(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
