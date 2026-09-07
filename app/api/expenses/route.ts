import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createExpenseSchema } from "@/lib/validation/expenses";
import { createExpense, listExpenses } from "@/lib/services/expenses";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.log_expense");
    const input = createExpenseSchema.parse(await request.json());
    const expense = await createExpense(session, input);
    return ok(expense, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.view");
    const { searchParams } = request.nextUrl;
    const expenses = await listExpenses({ status: searchParams.get("status") ?? undefined });
    return ok(expenses);
  } catch (err) {
    return handleRouteError(err);
  }
}
