import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { openCashShiftSchema } from "@/lib/validation/cash-shift";
import { openShift, listCashShifts } from "@/lib/services/cash-shift";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.view");
    const shifts = await listCashShifts();
    return ok(shifts);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.manage_cash_shift");
    const input = openCashShiftSchema.parse(await request.json());
    const shift = await openShift(session, input);
    return ok(shift, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
