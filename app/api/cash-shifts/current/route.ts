import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { getCurrentShift } from "@/lib/services/cash-shift";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.manage_cash_shift");
    const shift = await getCurrentShift();
    return ok(shift);
  } catch (err) {
    return handleRouteError(err);
  }
}
