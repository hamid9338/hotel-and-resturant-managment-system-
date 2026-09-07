import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { approveExpense } from "@/lib/services/expenses";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.approve_expense");
    const { id } = await params;
    const expense = await approveExpense(session, id);
    return ok(expense);
  } catch (err) {
    return handleRouteError(err);
  }
}
