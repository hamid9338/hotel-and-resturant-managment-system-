import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { closeCashShiftSchema } from "@/lib/validation/cash-shift";
import { closeShift } from "@/lib/services/cash-shift";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.manage_cash_shift");
    const input = closeCashShiftSchema.parse(await request.json());
    const { id } = await params;
    const shift = await closeShift(session, id, input);
    return ok(shift);
  } catch (err) {
    return handleRouteError(err);
  }
}
