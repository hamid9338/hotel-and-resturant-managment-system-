import { rejectExpenseSchema } from "@/lib/validation/expenses";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { rejectExpense } from "@/lib/services/expenses";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.approve_expense");
    const input = rejectExpenseSchema.parse(await request.json().catch(() => ({})));
    const { id } = await params;
    const expense = await rejectExpense(session, id, input);
    return ok(expense);
  } catch (err) {
    return handleRouteError(err);
  }
}
