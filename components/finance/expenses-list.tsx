"use client";

import { useEffect, useState, useCallback } from "react";
import { Receipt, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ExpenseFormModal } from "@/components/finance/expense-form-modal";

type Expense = {
  id: string;
  category: string;
  amount: string;
  method: string | null;
  status: string;
  notes: string | null;
  receiptUrl: string | null;
  createdAt: string;
  createdBy: { name: string };
  approvedBy: { name: string } | null;
};

const STATUS_TONE: Record<string, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function ExpensesList({ currency }: { currency: string }) {
  const toast = useToast();
  const { has } = usePermissions();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api
      .get<Expense[]>("/api/expenses")
      .then(setExpenses)
      .catch(() => setExpenses([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    try {
      await api.post(`/api/expenses/${id}/approve`, {});
      toast.success("Expense approved");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not approve expense.");
    }
  };

  const reject = async (id: string) => {
    try {
      await api.post(`/api/expenses/${id}/reject`, {});
      toast.success("Expense rejected");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reject expense.");
    }
  };

  if (expenses === null) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-2">
          <a href="/api/expenses?format=csv">
            <Button size="sm" variant="secondary">
              <Download size={13} /> Export CSV
            </Button>
          </a>
          {has("finance.log_expense") && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              + Expense
            </Button>
          )}
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses logged" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Logged By</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border-default last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.category}</div>
                      {e.notes && <div className="text-xs text-muted">{e.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {e.createdBy.name} · {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-muted">{e.method ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(e.amount), currency)}</td>
                    <td className="px-4 py-3 text-right">
                      {has("finance.approve_expense") && e.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="primary" onClick={() => approve(e.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => reject(e.id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {creating && (
        <ExpenseFormModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}
