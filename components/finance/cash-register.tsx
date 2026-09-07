"use client";

import { useEffect, useState, useCallback } from "react";
import { Landmark } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDateTime } from "@/lib/format";

type CurrentShift = {
  id: string;
  openedAt: string;
  openingFloat: string;
  livePreview: number;
  openedBy: { name: string };
} | null;

type ClosedShift = {
  id: string;
  openedAt: string;
  closedAt: string;
  openingFloat: string;
  closingCountedAmount: string;
  expectedAmount: string;
  variance: string;
  openedBy: { name: string };
  closedBy: { name: string } | null;
};

export function CashRegister({ currency }: { currency: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState<CurrentShift | undefined>(undefined);
  const [history, setHistory] = useState<ClosedShift[]>([]);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingModal, setClosingModal] = useState(false);
  const [countedAmount, setCountedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    api
      .get<CurrentShift>("/api/cash-shifts/current")
      .then(setCurrent)
      .catch(() => setCurrent(null));
    api
      .get<ClosedShift[]>("/api/cash-shifts")
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const open = async () => {
    setLoading(true);
    try {
      await api.post("/api/cash-shifts", { openingFloat: Number(openingFloat) || 0 });
      toast.success("Shift opened");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not open shift.");
    } finally {
      setLoading(false);
    }
  };

  const close = async () => {
    if (!current) return;
    setLoading(true);
    try {
      await api.post(`/api/cash-shifts/${current.id}/close`, {
        closingCountedAmount: Number(countedAmount) || 0,
        notes: notes.trim() || undefined,
      });
      toast.success("Shift closed");
      setClosingModal(false);
      setCountedAmount("");
      setNotes("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not close shift.");
    } finally {
      setLoading(false);
    }
  };

  if (current === undefined) return <SkeletonRows rows={4} />;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Cash Register</h1>

      {current ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-medium">Shift open — {current.openedBy.name}</div>
              <div className="text-xs text-muted">Opened {formatDateTime(current.openedAt)}</div>
            </div>
            <Badge tone="success">OPEN</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Opening Float" value={formatCurrency(Number(current.openingFloat), currency)} />
            <StatCard label="Expected Now" value={formatCurrency(current.livePreview, currency)} tone="accent" />
          </div>
          <Button variant="primary" className="mt-4" onClick={() => setClosingModal(true)}>
            Close Shift
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-3 font-medium">No shift is currently open</div>
          <div className="flex items-end gap-3">
            <div>
              <Label>Opening Float</Label>
              <Input type="number" min={0} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className="w-40" />
            </div>
            <Button variant="primary" loading={loading} onClick={open}>
              Open Shift
            </Button>
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">Recent Shifts</h2>
        {history.length === 0 ? (
          <EmptyState icon={Landmark} title="No closed shifts yet" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Opened</th>
                    <th className="px-4 py-3">Closed</th>
                    <th className="px-4 py-3 text-right">Expected</th>
                    <th className="px-4 py-3 text-right">Counted</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className="border-b border-border-default last:border-0">
                      <td className="px-4 py-3 text-xs text-muted">
                        {formatDateTime(s.openedAt)} · {s.openedBy.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {formatDateTime(s.closedAt)} · {s.closedBy?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(s.expectedAmount), currency)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(s.closingCountedAmount), currency)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${Number(s.variance) !== 0 ? "text-danger" : "text-success"}`}>
                        {formatCurrency(Number(s.variance), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {closingModal && current && (
        <Modal
          title="Close Shift"
          onClose={() => setClosingModal(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setClosingModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={loading} onClick={close}>
                Confirm Close
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm">
              System expects <span className="font-mono font-medium">{formatCurrency(current.livePreview, currency)}</span> in the
              drawer right now.
            </div>
            <div>
              <Label>Counted Amount</Label>
              <Input type="number" min={0} value={countedAmount} onChange={(e) => setCountedAmount(e.target.value)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
