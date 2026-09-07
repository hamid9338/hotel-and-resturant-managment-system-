import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listStockMovements } from "@/lib/services/inventory";
import { ok, handleRouteError } from "@/lib/api/respond";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.view");
    const { id } = await params;
    const movements = await listStockMovements(id);

    if (new URL(req.url).searchParams.get("format") === "csv") {
      const csv = toCsv(
        ["Date", "Source", "Quantity Delta", "Related ID", "Reason", "By"],
        movements.map((m) => [
          m.createdAt.toISOString(),
          m.source,
          m.quantityDelta.toString(),
          m.relatedId ?? "",
          m.reason ?? "",
          m.createdBy.name,
        ])
      );
      return csvResponse("stock-movements.csv", csv);
    }

    return ok(movements);
  } catch (err) {
    return handleRouteError(err);
  }
}
