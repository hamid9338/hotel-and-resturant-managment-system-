import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit } from "@/lib/services/audit";
import { toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type { createExpenseSchema, rejectExpenseSchema } from "@/lib/validation/expenses";

type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;

const expenseInclude = {
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
} as const;

export async function listExpenses(filters: { status?: string }) {
  return prisma.expense.findMany({
    where: { status: filters.status ? (filters.status as never) : undefined },
    include: expenseInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createExpense(session: SessionUser, input: CreateExpenseInput) {
  const expense = await prisma.expense.create({
    data: {
      category: input.category,
      amount: input.amount,
      method: input.method,
      notes: input.notes,
      receiptUrl: input.receiptUrl,
      createdById: session.id,
    },
    include: expenseInclude,
  });

  await recordAudit({
    session,
    action: `Expense logged: ${expense.category} — ${input.amount}`,
    module: "Finance",
    entityType: "Expense",
    entityId: expense.id,
    details: input.notes,
  });

  return expense;
}

/**
 * Always creates a Payment(OUT) row, for every payment method — not just
 * cash. This is what makes cash-shift reconciliation (which sums Payment
 * rows) correct with zero special-casing; skipping it for non-cash methods
 * would leave the Payment table an incomplete ledger.
 */
export async function approveExpense(session: SessionUser, id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new AppError("EXPENSE_NOT_FOUND", "Expense not found.", 404);
  if (expense.status !== "PENDING") {
    throw new AppError("INVALID_EXPENSE_STATE", "Only a pending expense can be approved.", 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.expense.update({
      where: { id },
      data: { status: "APPROVED", approvedById: session.id, approvedAt: new Date() },
      include: expenseInclude,
    });

    await tx.payment.create({
      data: {
        expenseId: id,
        amount: expense.amount,
        method: expense.method!,
        direction: "OUT",
        receivedById: session.id,
      },
    });

    return result;
  });

  await recordAudit({
    session,
    action: `Expense approved: ${expense.category} — ${toNumber(expense.amount)}`,
    module: "Finance",
    entityType: "Expense",
    entityId: expense.id,
  });

  return updated;
}

export async function rejectExpense(session: SessionUser, id: string, input: RejectExpenseInput) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new AppError("EXPENSE_NOT_FOUND", "Expense not found.", 404);
  if (expense.status !== "PENDING") {
    throw new AppError("INVALID_EXPENSE_STATE", "Only a pending expense can be rejected.", 409);
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: { status: "REJECTED", approvedById: session.id, approvedAt: new Date() },
    include: expenseInclude,
  });

  await recordAudit({
    session,
    action: `Expense rejected: ${expense.category} — ${toNumber(expense.amount)}`,
    module: "Finance",
    entityType: "Expense",
    entityId: expense.id,
    details: input.reason,
  });

  return updated;
}
